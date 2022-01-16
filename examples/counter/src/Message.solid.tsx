interface Props {
  message: string;
}

const props = $props<Props>();

export default $view<Props>(<span>{props.message}</span>);
