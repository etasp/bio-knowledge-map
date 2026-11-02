"""Exercise an exported library in an isolated offline Chromium context."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright


def check(path, browser_path=None):
    path = Path(path).resolve()
    qa = path.parent / 'qa'
    qa.mkdir(exist_ok=True)
    errors, external = [], []
    with sync_playwright() as p:
        options = {'headless': True}
        if browser_path:
            options['executable_path'] = str(browser_path)
        browser = p.chromium.launch(**options)
        context = browser.new_context(viewport={'width': 1440, 'height': 1000}, offline=True)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: external.append(request.url) if request.url.startswith(('https://', 'http://')) else None)
        page.goto(path.as_uri())
        page.wait_for_function("document.querySelector('#nativeGraphFrame')?.dataset.ready==='true'", timeout=15000)
        frame = page.frame_locator('#nativeGraphFrame')
        frame.locator('#study-first-topic').click()
        frame.locator('.study-title').wait_for()
        assert frame.locator('.study-title').inner_text()
        frame.locator('[data-study-source]').first.click()
        assert page.locator('#detail').evaluate('el=>el.open')
        assert page.locator('#rawText').inner_text()
        page.locator('#detail .close').click()
        page.locator('#showCards').click()
        page.locator('.card').first.wait_for()
        first_id = page.locator('.card [data-action="open"]').first.get_attribute('data-id')
        page.locator('.card [data-action="open"]').first.click()
        assert not page.locator('#detail details').evaluate('el=>el.open')
        page.locator('#detail details summary').click()
        assert page.locator('#detail details').evaluate('el=>el.open')
        page.locator('#detail [data-action="review"]').click()
        page.locator('#detail .close').click()
        page.locator('[data-view="review"]').click()
        assert page.locator(f'.card [data-id="{first_id}"]').count()
        page.reload()
        page.wait_for_function("document.querySelector('#nativeGraphFrame')?.dataset.ready==='true'")
        page.locator('#showCards').click()
        page.locator('[data-view="review"]').click()
        assert page.locator(f'.card [data-id="{first_id}"]').count()
        page.locator('[data-view="quiz"]').click()
        assert page.locator('.answer').count() == 0
        page.locator('#reveal').click()
        assert page.locator('.answer').inner_text()
        page.locator('#again').click()
        page.locator('[data-view="learn"]').click()
        title = page.locator('.card h3').first.inner_text()
        page.locator('#search').fill(title)
        assert page.locator('.card').count() > 0
        page.locator('#search').fill('')
        page.screenshot(path=str(qa / 'desktop.png'), full_page=False)
        page.set_viewport_size({'width': 390, 'height': 844})
        page.locator('[data-view="graph"]').click()
        page.wait_for_function("document.querySelector('#nativeGraphFrame')?.dataset.ready==='true'")
        graph_frame = page.locator('#nativeGraphFrame').element_handle().content_frame()
        graph_frame.wait_for_function('network.physics.physicsEnabled===false')
        graph_frame.evaluate('network.fit({animation:false});network.redraw()')
        page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
        page.screenshot(path=str(qa / 'mobile.png'), full_page=False)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
        assert not errors, errors
        assert not external, external
        browser.close()
    summary = dict(offline=True, graph_click=True, source_lookup=True, answer_hidden=True, review_persists=True, search=True, mobile_width=390, browser_errors=errors, external_requests=external)
    (qa / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
    return summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('page', type=Path)
    parser.add_argument('--browser', type=Path)
    args = parser.parse_args()
    print(json.dumps(check(args.page, args.browser), ensure_ascii=False))
