# Profile photo reliability — 24 October 2026

## Causes addressed

- Mobile rebased old public `/storage` URLs but not authenticated `/api/employees/{id}/photo` URLs. A server-generated localhost URL could therefore work on desktop and fail on a physical phone. Private photo requests now follow the configured mobile API base.
- Web photo requests used absolute server URLs, bypassing the configured API/proxy. They now use the authenticated API client with a validated employee-photo endpoint.
- Replacements reused the same URL. Profile, session and dashboard resources now share a URL version derived from the stored file path. Successful replacements therefore invalidate image identity consistently.
- The backend deleted the previous file before storing/committing the replacement. Replacement now locks the employee, stores privately, updates profile and audit data transactionally, and only then deletes the old file. Failed database operations clean up the new orphan; failed storage leaves the old reference intact.
- Mobile picker output could be an unsupported or oversized original. Expo's compatible image manipulator converts the selected image to JPEG, limits the longest side to 1024 pixels, and checks the 2 MB limit before upload. Picker/preparation failures are displayed and the prior selection is preserved.
- Web now validates JPEG/PNG/WebP and the 2 MB limit before upload, clears successful local previews, revokes preview object URLs, and updates profile query data directly from the response.
- Web image state is scoped to the token and endpoint. Mobile credentials are attached only to private employee-photo requests, never local previews or unrelated remote images. Photo responses use private/no-store caching. Existing authorization and tenant restrictions remain in force.

## Local data recovery

A read-only audit found four photo records: two private and two public-only, none missing entirely. The existing `employees:migrate-passport-photos-to-private` command copied the two legacy files. A subsequent audit found four private, zero public-only and zero missing files. Original public copies were preserved. No production environment was modified.

Deployment environments with legacy uploads need the same existing migration procedure. Retiring old public copies is a separate step described by `docs/audits/07-pre-launch-fixes-deployment-checklist.md`. A database backup alone cannot recover a missing image file; preserve private storage across deployments.

## Validation

- `php -d opcache.enable_cli=1 vendor/phpunit/phpunit/phpunit tests/Feature/Employees/EmployeePhotoAccessTest.php --log-junit tmp/profile-photo-tests.xml`: **11 tests, 40 assertions, passed**. Includes real multipart method override, replacement/version changes, fresh authenticated session reads, preservation on disk/database failure, oversized/invalid uploads and existing tenant/access checks. Uses isolated SQLite and fake storage; not a MySQL concurrency proof.
- Web `npm run build`: passed. Existing large-bundle warning remains.
- Web `npm run lint`: no errors; existing unrelated warnings remain.
- Web `node --test tests/profile-photo.test.mjs`: **2 passed**.
- Mobile `npm run typecheck`: passed after installing `expo-image-manipulator` through `expo install`.
- Mobile `npm run lint`: no errors; one existing unused-import warning in calendar API.
- Mobile `npm test`: **28 passed**, including three new photo tests for URL routing/credential handling, resizing/JPEG metadata and oversized output rejection. Image conversion is mocked in these contract tests.
- Targeted PHP formatting passed. The complete backend suite was not rerun for this change.

## Device acceptance check

Restart Expo after the dependency update. Use the existing LASHMA demo credentials and a reachable `EXPO_PUBLIC_API_BASE_URL`.

1. On web, upload a JPEG/PNG/WebP under 2 MB; check profile and topbar, refresh, sign out and sign back in.
2. In Expo Go, select a large phone photo, save, inspect Profile and Home, restart the app and sign back in.
3. Replace it with a visibly different image and confirm both clients show the replacement after refreshing their profile/session data.
4. Cancel selection, deny picker access, disconnect during upload and retry. A failed save must retain the previous server photo.
5. Switch between two employees and verify one account's photo is never shown for the other.

Native image conversion, device picker behavior, physical-phone connectivity and visual persistence still require this device pass. The image manipulator is included in Expo Go; custom development/production builds must include the new native dependency. See the [SDK 57 image manipulator documentation](https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/).

Changes are uncommitted. Existing demo enrichment, concurrent pagination/mobile work, Connect and the Life worktree were not staged or overwritten.
