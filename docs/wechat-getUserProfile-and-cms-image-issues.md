# WeChat getUserProfile Failure & CMS Remark Image Issues (Investigation)

## 1. WeChat Login: `getUserProfile:fail getUserAvatarInfo fail`

### Phenomenon
- In production and test, `wx.getUserProfile` fails with: `getUserProfile:fail getUserAvatarInfo fail`.
- Environment: Windows, mp, 1.06.2504010; lib: 3.8.11.
- Project code was not changed recently; failure started suddenly.

### Root Cause (Not a Developer Tool Setting)
This is **not** caused by a WeChat developer tool setting. It is due to WeChat platform policy and environment:

1. **API deprecation / restriction**
   - Since 2022-10-25, `wx.getUserProfile` (and `wx.getUserInfo`) are deprecated for new releases.
   - From **base library 2.27.1**, WeChat further restricted these APIs; in many cases they no longer return real avatar/nickname (gray avatar + "微信用户").
   - Error `getUserAvatarInfo fail` often appears when the runtime cannot provide avatar info (e.g. overseas users, newer base lib, or policy enforcement).

2. **Overseas / region**
   - Community reports indicate **overseas users** see `getUserProfile:fail getUserAvatarInfo fail` more often; domestic users may still work in some versions.

3. **Base library version**
   - Lower base lib (e.g. 2.27.0 or below) can still return avatar/nickname in some environments, but relying on this is not recommended.

### Official replacement (since base lib 2.21.2)
- **Avatar**: Use `<button open-type="chooseAvatar" bind:chooseavatar="onChooseAvatar">` to get a **temporary file path**; upload to your server (e.g. via `wx.uploadFile`) and store the URL.
- **Nickname**: Use `<input type="nickname" />`; user can type or use the WeChat nickname hint; collect on form submit. From 2.24.4+, content is checked for security.

References:
- [头像昵称填写](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/userProfile.html)
- [wx.getUserProfile](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/user-info/wx.getUserProfile.html)

### Recommended approach
1. **Short term**: When `getUserProfile` fails, **fall back to code-only login** (`wx.login` + backend auth). Do not block login; optionally show a message like “获取用户信息失败，已使用微信授权登录”.
2. **Medium term**: Replace the deprecated flow with **“头像昵称填写”**: chooseAvatar button + nickname input, then upload avatar and save nickname on your backend.

### Developer tool
- You cannot “fix” this by changing a single setting in the developer tool; the behavior is driven by base library and WeChat account/region.
- For local debugging you can try lowering the “基础库版本” to 2.27.0 in the project settings to see if avatar/nickname appear again, but production will still follow the platform policy above.

---

## 2. CMS “预约产品编辑” / Remark images from S3

### Phenomenon
- Previously, remark images could be obtained from S3 URLs and used as “备注图片” uploads; after recent improvements this flow started failing.

### Need clarification
- **Exact page**: e.g. 预约推广编辑（PreorderPromotesEditor：头图/轮播图） or 订单编辑（OrderEditModal：订单项备注图片） or another?
- **Exact operation**: e.g. “已有 S3 路径的图片在编辑页显示/回填” or “从 S3 地址下载后再作为新图片上传”?
- **Error message**: What exact error (frontend console / network / backend log)?

### Current code (for reference)
- **PreorderPromotesEditor**: Uses `contentUtil.getContentUrlImage(env, 'images', path, ...)` to display existing header/carousel images; new uploads use Ant Design `Upload` with `originFileObj`. Only items with `originFileObj` are appended to FormData on submit; existing S3 paths are sent via `currentHeaderImage` / `currentCarouselImages` to the update API.
- **OrderEditModal**: Displays order item `noteImages` with `contentUtil.getContentUrlImage`; no upload of “remark images” in this modal (read-only display).

If the failure is “paste S3 URL and use as new image”, that path may never have been implemented in the current codebase; if it is “existing S3 images no longer show or save”, the next step is to check CORS, auth, or recent changes to `getContentUrlImage` / backend update API.

---

---

## 3. wx.login: INVALID_LOGIN, access_token expired

### Phenomenon
`wx.login` fails with: `login:fail INVALID_LOGIN,access_token expired [date][appid]`.

### Cause
Developer tool / simulator login session expired. Not a code bug. Common in IDE after long use or stale cached auth.

### Fix (environment)
- **Clear auth**: In WeChat dev tool: 清除模拟器缓存 → 清除授权数据.
- **Re-login**: Exit dev tool and scan QR again to re-login.

Ref: [微信开放社区](https://developers.weixin.qq.com/community/develop/doc/0006ac66918a98e5a9e02482863c00).

---

## Summary
| Issue | Cause | Fix |
|-------|--------|-----|
| `getUserProfile:fail getUserAvatarInfo fail` | WeChat policy + base lib; not dev tool config | Fallback to code-only login; migrate to chooseAvatar + nickname |
| `wx.login: INVALID_LOGIN, access_token expired` | Dev tool / simulator login session expired | Clear auth data or re-scan login in dev tool |
| CMS remark/S3 images | Unclear without exact page + operation + error | Confirm page, operation, and error; then trace contentUtil/upload/API |
