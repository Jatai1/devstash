import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * Up to two initials for a display name: "Brad Traversy" becomes "BT".
 *
 * Falls back to the first character of whatever it was given, which covers the
 * accounts that have no name and render their email instead.
 */
export function getInitials(displayName: string): string {
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

  return (initials || displayName.slice(0, 1)).toUpperCase();
}

interface UserAvatarProps {
  /** The user's avatar URL — GitHub's, when they signed in that way. */
  image: string | null;
  /** What the initials are derived from; also the accessible label. */
  displayName: string;
  className?: string;
}

/**
 * A user's avatar: their image when they have one, their initials when they do
 * not.
 *
 * `AvatarImage` is only rendered when there is a `src`, so the fallback shows
 * immediately rather than after a failed request. Radix keeps the fallback in
 * place if the image itself 404s, so a dead GitHub URL degrades to initials.
 */
export function UserAvatar({ image, displayName, className }: UserAvatarProps) {
  return (
    <Avatar className={cn("size-8 rounded-full", className)}>
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback className="rounded-full text-xs">
        {getInitials(displayName)}
      </AvatarFallback>
    </Avatar>
  );
}
