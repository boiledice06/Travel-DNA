import * as Location from 'expo-location';
/** GPS can hang indoors; return control to the user after 12 seconds. */
export async function getCurrentCoordinates() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Location timed out')), 12000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
