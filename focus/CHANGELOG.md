# Changelog

## 0.3.2

- Open reply uses a native X thread, bypassing pagination for that specific reply.
- Preserve the native view if X removes the query marker; resume pagination on other posts.

## 0.3.1

- Add in-place reply pagination: 10 replies per page, 6 pages maximum.
- Add a 1.5-second forward pause; keep cached backward navigation immediate.
- Render bounded reply cards outside X’s comment virtualizer while retaining the native original post and composer.
- Place thumb-sized pagination directly below the last reply, above reserved toolbar space.
- Reserve media dimensions before image loading and cancel pending requests on route changes.

## 0.1.0

- Default Home to Following and block fullscreen video swipes / automatic next clips.
