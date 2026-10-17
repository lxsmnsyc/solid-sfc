```html
<script>
  import { fetchUser } from './api';

  const { id } = $props<{ id: string }>();
  const user = $memo(fetchUser(id));
  let open = $signal(false);
</script>

<style>
  .card {
    border-color: ${open ? 'royalblue' : 'silver'};
  }
</style>

<section class="card">
  #loading {
    <h2>{user.name}</h2>
    <button onClick=(() => (open = !open))>Details</button>
    #if (open) {
      #for (post of user.posts by post.id) {
        <a href=post.url>{post.title}</a>
      }
    }
  } #else {
    <p>Loading…</p>
  }
</section>
```
