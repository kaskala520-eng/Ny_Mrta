# Security Specification — Meta.Ny Firestore & File Storage

## 1. Data Invariants
1. **Default-Deny Catch-All**: Unmatched paths in Firestore are denied (`allow read, write: if false;`).
2. **Verified Identity & Ownership**:
   - Every `/users/{userId}` document can only be created or read/modified by `request.auth.uid == userId` or a verified admin (`isAdmin()`).
   - PII (`email`) is strictly isolated into `/users/{userId}/private/{docId}` with owner-only or admin-only access.
   - Regular users are blocked from elevating privileges (`isVIP`, `isBanned`, `hideAds` are protected or server/admin-controlled during updates; new users start with `isVIP == false`, `isBanned == false`).
3. **Order Ownership & Admin Inspection**:
   - `/orders/{orderId}` documents must carry `ownerUid == request.auth.uid` on create and match the path `orderId` (`isValidId(orderId)`).
   - `list` queries on `/orders` enforce `resource.data.ownerUid == request.auth.uid || isAdmin()`.
   - Only admins can delete orders or mark server files permanently deleted across users, or view orders belonging to other users.
4. **Immutable Fields & Temporal Integrity**:
   - `ownerUid`, `uid`, `id`, and `createdAt` are immutable after creation.
   - `createdAt == request.time` on create; `updatedAt == request.time` on update.

## 2. The "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated order create**: Creating `/orders/ord_1` with `request.auth == null`. -> `PERMISSION_DENIED`
2. **Unverified email order create**: Creating `/orders/ord_1` with `email_verified: false`. -> `PERMISSION_DENIED`
3. **Identity spoofing on order**: User A (`uidA`) creates `/orders/ord_2` with `ownerUid: "uidB"`. -> `PERMISSION_DENIED`
4. **Shadow field injection ("ghost field")**: Creating `/orders/ord_3` with extra field `isAdminApproved: true`. -> `PERMISSION_DENIED`
5. **Privilege escalation on profile create**: User creates `/users/uidA` with `isVIP: true` or `isBanned: false` modified after creation. -> `PERMISSION_DENIED`
6. **Direct write to `/admins/{uid}` by normal user**: Non-admin tries to grant themselves admin doc. -> `PERMISSION_DENIED`
7. **ID poisoning attack**: Document ID containing >128 chars or special characters (`../foo$bar`). -> `PERMISSION_DENIED`
8. **Value poisoning / Denial of Wallet**: Sending a 50KB `details` string (>500 chars) or 1MB `outputPreview`. -> `PERMISSION_DENIED`
9. **Client timestamp forgery**: Sending a backdated `createdAt` not equal to `request.time`. -> `PERMISSION_DENIED`
10. **PII scrape**: User B attempts `get` or `list` on `/users/uidA/private/info`. -> `PERMISSION_DENIED`
11. **Unauthorized order scrape**: User B queries `/orders` with `allow list` trying to read User A's orders without admin role. -> `PERMISSION_DENIED`
12. **Immutable owner tampering on update**: User A tries to change `ownerUid` or `createdAt` when updating `/orders/ord_1`. -> `PERMISSION_DENIED`
