import { JSX } from 'solid-js';

export default function OtherMessage(props: Record<string, string>): JSX.Element {
  return (
    <span>{props.message}</span>
  );
}
