interface Props {
  message: string;
}

const props = $defineProps<Props>();

export default $view<Props>(<span>{props.message}</span>);
