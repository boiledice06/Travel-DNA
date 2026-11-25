import type { PlacePhoto, Place } from '../../types/index.ts';

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeUrl(value: unknown, hosts: readonly string[]): value is string {
  if (typeof value !== 'string' || value.length > 900) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      hosts.includes(url.hostname) &&
      !url.port &&
      !url.username &&
      !url.password &&
      (!url.search ||
        (url.hostname === 'www.kcdf.or.kr' &&
          ((url.pathname === '/com/file/filedown' &&
            /^\?_ci=\d+&_ck=[a-f\d-]+$/.test(url.search)) ||
            (url.pathname === '/brd/board/324/L/menu/293' &&
              /^\?bbIdx=\d+&brdType=R$/.test(url.search))))) &&
      !url.hash &&
      url.pathname !== '/'
    );
  } catch {
    return false;
  }
}

const tourHosts = ['tong.visitkorea.or.kr', 'cdn.visitkorea.or.kr'];
export function decodePlacePhoto(value: unknown): PlacePhoto | undefined {
  if (!object(value)) return;
  const {
    provider,
    url,
    source_page,
    publisher,
    author,
    license,
    license_url,
    can_modify,
    match,
    description,
    attribution,
  } = value;
  if (
    provider !== 'tourapi' &&
    provider !== 'gallery' &&
    provider !== 'commons' &&
    provider !== 'archive'
  )
    return;
  const commons = provider === 'commons';
  const archive = provider === 'archive';
  const imageHosts = archive
    ? ['archive.visitseoul.net', 'www.kcdf.or.kr']
    : commons
      ? ['upload.wikimedia.org', 'thumb.wikimedia.org']
      : provider === 'gallery'
        ? [...tourHosts, 'phoko.visitkorea.or.kr']
        : tourHosts;
  if (
    !safeUrl(url, imageHosts) ||
    !safeUrl(
      source_page,
      archive
        ? ['archive.visitseoul.net', 'www.kcdf.or.kr']
        : commons
          ? ['commons.wikimedia.org']
          : ['www.data.go.kr', 'korean.visitkorea.or.kr'],
    ) ||
    typeof publisher !== 'string' ||
    !publisher.trim() ||
    publisher.length > 100 ||
    (author !== null && (typeof author !== 'string' || !author.trim() || author.length > 220)) ||
    typeof license !== 'string' ||
    typeof can_modify !== 'boolean' ||
    !safeUrl(license_url, commons ? ['creativecommons.org'] : ['www.kogl.or.kr']) ||
    typeof description !== 'string' ||
    description.length > 400 ||
    typeof attribution !== 'string' ||
    attribution.length > 300 ||
    !Array.isArray(match) ||
    match.length === 0 ||
    match.length > 6 ||
    !match.every(
      (item): item is string => typeof item === 'string' && !!item.trim() && item.length < 180,
    )
  )
    return;
  if (commons) {
    const type = new URL(license_url).pathname.match(
      /^\/licenses\/(by|by-sa)\/(2\.0|2\.5|3\.0|4\.0)\/$/,
    );
    const cc0 =
      license === 'CC0 1.0' && license_url === 'https://creativecommons.org/publicdomain/zero/1.0/';
    if (
      (!cc0 && (!type || license !== `CC ${type[1].toUpperCase()} ${type[2]}`)) ||
      !can_modify ||
      !author
    )
      return;
  } else if (
    license_url !== 'https://www.kogl.or.kr/info/license.do' ||
    (license !== 'KOGL-1' && (license !== 'KOGL-3' || provider !== 'tourapi')) ||
    can_modify !== (license === 'KOGL-1')
  )
    return;
  return {
    provider,
    url,
    source_page,
    publisher,
    author,
    license,
    license_url,
    can_modify,
    match,
    description,
    attribution,
  };
}

export function decodePlacePhotos(value: unknown, requested: Place[]): Record<string, PlacePhoto> {
  const photos: Record<string, PlacePhoto> = {};
  if (!Array.isArray(value)) return photos;
  const allowed = new Set(requested.map((place) => place.id));
  for (const row of value) {
    if (!object(row) || typeof row.id !== 'string' || !allowed.delete(row.id)) continue;
    const photo = decodePlacePhoto(row.photo);
    if (photo) photos[row.id] = photo;
  }
  return photos;
}

export function withPlacePhotos(places: Place[], photos: Record<string, PlacePhoto>): Place[] {
  if (!Object.keys(photos).length) return places;
  return places.map((place) => (photos[place.id] ? { ...place, photo: photos[place.id] } : place));
}
