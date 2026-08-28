import { IdentityAvatar } from "../user/IdentityAvatar";
import {
  lookupSubscribedOwnerAvatar,
  lookupSubscribedPublisherHandle,
  useSubscribeCatalogLookups,
  type SubscribedCatalogEventRef,
  type SubscribeOwnerAvatarByHandle,
} from "../../domain/calendarShare/subscribedCatalogLookups";

function useSubscribeOwnerAvatarByHandle(
  override?: SubscribeOwnerAvatarByHandle,
): SubscribeOwnerAvatarByHandle {
  const { subscribeOwnerAvatarByHandle } = useSubscribeCatalogLookups();
  return override ?? subscribeOwnerAvatarByHandle;
}

/** Title-row publisher avatar for sidebar / day cards. */
export function SubscribedEventTitleMark({
  event,
  catalogOwnerAvatarByHandle,
}: {
  event: SubscribedCatalogEventRef;
  catalogOwnerAvatarByHandle?: SubscribeOwnerAvatarByHandle;
}) {
  const avatarByHandle = useSubscribeOwnerAvatarByHandle(catalogOwnerAvatarByHandle);
  const src = lookupSubscribedOwnerAvatar(event, avatarByHandle);
  const label = lookupSubscribedPublisherHandle(event);
  if (!label) return null;
  return (
    <IdentityAvatar
      label={label}
      src={src}
      size="sm"
      testId="subscribed-event-avatar"
    />
  );
}
