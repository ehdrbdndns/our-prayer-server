import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { EXPO_ACCESS_TOKEN } from './keys';


// Create a new Expo SDK client
// optionally providing an access token if you have enabled push security
let expo = new Expo({
  accessToken: EXPO_ACCESS_TOKEN,
  /*
   * @deprecated
   * The optional useFcmV1 parameter defaults to true, as FCMv1 is now the default for the Expo push service.
   *
   * If using FCMv1, the useFcmV1 parameter may be omitted.
   * Set this to false to have Expo send to the legacy endpoint.
   *
   * See https://firebase.google.com/support/faq#deprecated-api-shutdown
   * for important information on the legacy endpoint shutdown.
   *
   * Once the legacy service is fully shut down, the parameter will be removed in a future PR.
   */
  useFcmV1: true,
});

async function pushNotification({
  pushTokens,
  sound,
  data,
  title,
  subtitle,
  body,
  badge
}: {
  pushTokens: string[],
  sound: string,
  data: Record<string, unknown>,
  title: string,
  subtitle: string,
  body: string,
  badge: number,
}) {

  let messages: ExpoPushMessage[] = [];
  for (let pushToken of pushTokens) {
    if (!Expo.isExpoPushToken(pushToken)) {
      console.error(`Push token ${pushToken} is not a valid Expo push token`);
      continue;
    }

    messages.push({
      to: pushToken,
      sound,
      data,
      body,
      badge,
      title,
      subtitle,
    });
  }

  let chunks = expo.chunkPushNotifications(messages);

  let tickets: ExpoPushTicket[] = [];
  for (let chunk of chunks) {
    try {
      let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error(error);
    }
  }
}
export { pushNotification };