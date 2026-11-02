"""Build the offline study site from evidence-backed, agent-authored knowledge JSON."""
import argparse
from collections import defaultdict
import html
import json
from pathlib import Path
import re
import shutil

ASSETS = Path(__file__).resolve().parents[1] / 'assets'


def load(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))


def js(value):
    return json.dumps(value, ensure_ascii=False).replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')


def local_file(root, relative):
    if not isinstance(relative, str) or not relative or Path(relative).is_absolute() or '\\' in relative or ':' in relative:
        raise ValueError(f'Expected portable project-relative path: {relative!r}')
    target = (root / relative).resolve()
    if root not in target.parents or not target.is_file():
        raise ValueError(f'Missing or out-of-project file: {relative}')
    return target


def require_text(value, label):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f'Missing text: {label}')


def validate(data, project):
    require_text(data.get('title'), 'title')
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}', data.get('library_id', '')):
        raise ValueError('library_id must use lowercase letters, numbers and hyphens')
    chapters = data.get('chapters', [])
    if not isinstance(chapters, list) or len(chapters) < 2 or not all(isinstance(c, str) and c.strip() for c in chapters):
        raise ValueError('chapters needs overview followed by actual chapter names')
    if not isinstance(data.get('lessons'), dict):
        raise ValueError('lessons must be an object')
    sources = {}
    for source in data.get('sources', []):
        sid = source.get('id', '')
        if not re.fullmatch(r'[a-z0-9_]+', sid) or sid in sources:
            raise ValueError(f'Invalid or duplicate source id: {sid}')
        for key in ('name', 'original_path', 'kind', 'text_file'):
            require_text(source.get(key), f'{sid}.{key}')
        original = source['original_path']
        if original.startswith(('/', '\\')) or ':' in original or '..' in original.replace('\\', '/').split('/'):
            raise ValueError(f'Use a relative original_path: {sid}')
        source['text'] = local_file(project, source['text_file']).read_text(encoding='utf-8-sig')
        if source.get('original_file'):
            local_file(project, source['original_file'])
        if not isinstance(source.get('chapters'), list) or any(type(c) is not int or not 0 < c < len(chapters) for c in source['chapters']):
            raise ValueError(f'Invalid source chapters: {sid}')
        sources[sid] = source
    if not sources:
        raise ValueError('No sources supplied')
    ids = set()
    for node in data.get('nodes', []):
        nid = node.get('id', '')
        if not re.fullmatch(r'[a-z0-9_]+', nid) or nid in ids:
            raise ValueError(f'Invalid or duplicate card id: {nid}')
        ids.add(nid)
        for key in ('label', 'lesson', 'summary', 'pitfall', 'question', 'answer', 'source_id', 'source_location', 'evidence'):
            require_text(node.get(key), f'{nid}.{key}')
        if type(node.get('chapter')) is not int or not 0 < node['chapter'] < len(chapters):
            raise ValueError(f'Invalid chapter: {nid}')
        if node['lesson'] not in data['lessons']:
            raise ValueError(f'Unknown lesson: {nid}')
        if not isinstance(node.get('points'), list) or not node['points']:
            raise ValueError(f'Missing points: {nid}')
        for point in node['points']:
            require_text(point, f'{nid}.points')
        source = sources.get(node['source_id'])
        if source is None or node['evidence'] not in source['text']:
            raise ValueError(f'Evidence absent from source: {nid}')
        node['source_file'] = '文字资料/' + node['source_id'] + '.md'
    if not ids:
        raise ValueError('No knowledge cards supplied')
    pairs = set()
    for edge in data.get('edges', []):
        a, b = edge.get('source'), edge.get('target')
        if a not in ids or b not in ids or a == b:
            raise ValueError('Invalid edge endpoints')
        pair = tuple(sorted((a, b)))
        if pair in pairs:
            raise ValueError('Duplicate undirected edge; merge its rationale')
        pairs.add(pair)
        for key in ('relation', 'rationale'):
            require_text(edge.get(key), f'edge.{key}')
        if edge.get('confidence') not in ('EXTRACTED', 'INFERRED', 'AMBIGUOUS'):
            raise ValueError('Invalid edge confidence')
        if edge['confidence'] == 'EXTRACTED':
            for key in ('source_id', 'source_location', 'evidence'):
                require_text(edge.get(key), f'edge.{key}')
            source = sources.get(edge['source_id'])
            if source is None or edge['evidence'] not in source['text']:
                raise ValueError('Edge evidence absent from source')
    return data


def graph_html(data, output):
    import networkx as nx
    from graphify.export import to_html, to_json
    graph = nx.Graph()
    groups = defaultdict(list)
    for node in data['nodes']:
        graph.add_node(node['id'], **{k: v for k, v in node.items() if k != 'id'})
        groups[node['chapter'] - 1].append(node['id'])
    for edge in data.get('edges', []):
        graph.add_edge(edge['source'], edge['target'], **{k: v for k, v in edge.items() if k not in ('source', 'target')})
    labels = {c: data['chapters'][c + 1] for c in groups}
    if not to_html(graph, dict(groups), str(output / 'graph.html'), community_labels=labels):
        raise ValueError('Graphify did not generate a graph')
    to_json(graph, dict(groups), str(output / 'graph.json'), community_labels=labels)
    page = (output / 'graph.html').read_text(encoding='utf-8')
    vendor = (ASSETS / 'vendor/vis-network.min.js').read_text(encoding='utf-8')
    vendor = re.sub(r'</script', r'<\\/script', vendor, flags=re.I)
    page, count = re.subn(r'<script src="https://unpkg.com/vis-network@9\.1\.6/standalone/umd/vis-network\.min\.js".*?</script>', lambda _: '<script>' + vendor + '</script>', page, count=1, flags=re.S)
    if count != 1:
        raise ValueError('Graphify renderer changed; review template before updating dependency')
    page = page.replace('hidden: hide }', 'hidden: hide || !learningAllowed.has(n.id) }').replace('hidden: !cb.checked }', 'hidden: !cb.checked || !learningAllowed.has(n.id) }')
    for old, new in [('Search nodes...', '搜索知识点…'), ('>Node Info</h3>', '>知识讲解</h3>'), ('>Communities</h3>', '>知识分组</h3>'), ('>Select All</label>', '>全选</label>'), ('Click a node to inspect it', '点击节点查看讲解、原文与自测')]:
        page = page.replace(old, new)
    bridge = '\n'.join((ASSETS / name).read_text(encoding='utf-8') for name in ('native_graph_bridge.js', 'native_accessibility.js', 'native_welcome.js'))
    bridge = bridge.replace('__CHAPTER_NAMES__', js(['全书', *data['chapters'][1:]]))
    page = page.replace('</head>', '<style>' + (ASSETS / 'native_graph.css').read_text(encoding='utf-8') + '</style></head>')
    page = page.replace('</body>', '<script>' + bridge + '</script></body>')
    (output / 'graph.html').write_text(page, encoding='utf-8')
    return page


def build(knowledge, project, output):
    project, output = Path(project).resolve(), Path(output).resolve()
    if output == project:
        raise ValueError('Output must not replace the source project')
    data = validate(load(knowledge), project)
    if output.exists() and any(output.iterdir()):
        raise ValueError('Use a new empty delivery directory')
    output.mkdir(parents=True, exist_ok=True)
    (output / '文字资料').mkdir(exist_ok=True)
    clean_sources = []
    for source in data['sources']:
        (output / '文字资料' / (source['id'] + '.md')).write_text(source['text'], encoding='utf-8')
        link = ''
        if source.get('original_file'):
            attachment = local_file(project, source['original_file'])
            (output / '原始资料').mkdir(exist_ok=True)
            link = '原始资料/' + source['id'] + attachment.suffix.lower()
            shutil.copy2(attachment, output / link)
        clean_sources.append(dict(id=source['id'], name=source['name'], original_path=source['original_path'], text=source['text'], chapters=source['chapters'], kind='ppt' if source['kind'] in ('ppt', 'pptx', 'pdf') else source['kind'], original_link=link))
    native = graph_html(data, output)
    payload = dict(nodes=data['nodes'], edges=data.get('edges', []), sources=clean_sources, lessons=data['lessons'], graph_nodes=data['nodes'], native_graph=native, title=data['title'], chapters=data['chapters'])
    page = (ASSETS / 'study.html').read_text(encoding='utf-8')
    page = page.replace('__SOURCE_READER__', (ASSETS / 'source_reader.js').read_text(encoding='utf-8')).replace('__STUDY_DATA__', js(payload))
    page = page.replace('__CHAPTER_NAMES__', js(data['chapters'])).replace('__LIBRARY_ID__', data['library_id'])
    page = page.replace('__HTML_TITLE__', html.escape(data['title'], quote=True))
    (output / '开始学习.html').write_text(page, encoding='utf-8')
    # Keep editable input separate from runtime fields populated above.
    shutil.copy2(knowledge, output / 'knowledge.json')
    covered = {n['source_id'] for n in data['nodes']}
    report = dict(sources=len(data['sources']), cards=len(data['nodes']), edges=len(data.get('edges', [])), sources_without_cards=[s['id'] for s in data['sources'] if s['id'] not in covered], browser_verified=False)
    (output / 'coverage.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    (output / '使用说明.txt').write_text('打开“开始学习.html”即可离线学习。点击图谱或搜索进入知识点，可查原文、先答后翻、收藏和标记复习。\n记录保存在当前浏览器，可导出/导入迁移；文字提取不保留全部图示与公式，请核对原附件。\ncoverage.json 为结构统计，不代表所有教学内容已经完整覆盖或学科正确性通过人工审核。\n', encoding='utf-8')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('knowledge', type=Path)
    parser.add_argument('--project', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(build(args.knowledge, args.project, args.output), ensure_ascii=False))
