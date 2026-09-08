# Prepared review-submit qualification additions

Do not apply to the active full route run. Apply after it finishes, before the rebuilt page's qualification. Reuse `expanded-routes.spec.ts`, its existing configuration, `openTenantPage`, and the strict error finalizer. No new browser or setup mechanism is needed.

The current inventory has four review-submit routes, each at desktop 1440×900 and narrow 390×844: Pottery Klong Muang Beach, Pottery Krabi, Kikuzuki Japanese Robatayaki Izakaya, and Take Me Away. The bounded follow-up is eight cases. Its navigation URLs have no query token and must render the explicit unavailable-link panel.

After the existing document status check, retain the original response HTML instead of reading it only inside the build assertion:

```ts
const documentHtml = await response.text()
assertDocumentBuild(documentHtml)
```

After the existing mounted-app wait and main-count check, insert:

```ts
if (route.path.endsWith('/review-submit')) {
  const serverState = await page.evaluate(({ html, mainSelector }) => {
    const document = new DOMParser().parseFromString(html, 'text/html')
    const main = document.querySelector(mainSelector)
    if (!main) throw new Error('Review request server main is absent')
    return {
      heading: main.querySelector('h1')?.textContent?.trim(),
      forms: main.querySelectorAll('form').length,
    }
  }, { html: documentHtml, mainSelector: target.main })
  expect(serverState, 'Server rejects a missing review token').toEqual({
    heading: 'This review link is not available', forms: 0,
  })
  await expect(page.locator(target.main).getByRole('heading', {
    name: 'This review link is not available', exact: true,
  })).toBeVisible()
  await expect(page.locator(target.main).locator('form')).toHaveCount(0)
  await testInfo.attach('review-request-denial', {
    body: JSON.stringify({ tenant: tenant.alias, layout, path: route.path, serverState,
      clientErrorHeadingVisible: true, clientForms: 0 }),
    contentType: 'application/json',
  })
}
```

The HTML above is the actual original HTTP response, parsed without executing scripts. It is not production source inspection or mocked data. Scope assertions to the route main so unrelated shell controls cannot affect form counts. Keep the existing traversal, final text stability assertion, and `assertNoUnclassifiedFailures(testInfo)` unchanged; those enforce stability and clean hydration rather than merely observing the eventual error heading.

After setting the rebuilt exact `EXPECTED_NUXT_BUILD_ID` and the existing local or canonical-preview environment, run the existing config/spec with `--grep review-submit`. Discovery must report eight cases before execution. Do not exempt hydration warnings, validation console errors, HTTP failures, or aborted requests for these routes. The current SSR validation denial happens server-side and should not cause a browser resource error.

No browser execution or active-spec changes were made while preparing this addition.
