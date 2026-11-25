"""Collapse duplicate local HTTP work and keep session writes in order."""
from collections import OrderedDict
from concurrent.futures import Future, TimeoutError as WaitTimeout
from threading import Lock
from time import monotonic
from typing import Callable, TypeVar

from fastapi import HTTPException

T = TypeVar("T")
_lock = Lock()
_active: dict[tuple[str, str], tuple[str, Future]] = {}
_completed: OrderedDict[tuple[str, str, str], tuple[str, float, object]] = OrderedDict()


def run_once(scope: str, key: str, fingerprint: str, work: Callable[[], T], replay: str = "") -> T:
    scope_key = (scope, key)
    replay_key = (*scope_key, replay)
    with _lock:
        cached = _completed.get(replay_key) if replay else None
        if cached and cached[1] > monotonic():
            if cached[0] != fingerprint:
                raise HTTPException(409, "idempotency key reused with different input")
            return cached[2]
        active = _active.get(scope_key)
        if active and active[0] != fingerprint:
            raise HTTPException(409, "another request is active for this session")
        if active:
            future = active[1]
        else:
            future = Future()
            _active[scope_key] = (fingerprint, future)
    if active:
        try:
            return future.result(timeout=28 if scope == "chat" else 115)
        except WaitTimeout:
            raise HTTPException(503, "request is still active") from None
    try:
        result = work()
        with _lock:
            if replay:
                _completed[replay_key] = (fingerprint, monotonic() + 300, result)
                _completed.move_to_end(replay_key)
                if len(_completed) > 256:
                    _completed.popitem(last=False)
        future.set_result(result)
        return result
    except BaseException as exc:
        future.set_exception(exc)
        raise
    finally:
        with _lock:
            _active.pop(scope_key, None)
