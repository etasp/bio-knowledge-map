"""Small regression check: deduplication and source/evidence boundaries."""
from copy import deepcopy
from pathlib import Path
from tempfile import TemporaryDirectory
import zipfile
from intake import intake
from build import load, validate


def main():
    with TemporaryDirectory() as folder:
        root = Path(folder)
        archive = root / 'lessons.zip'
        with zipfile.ZipFile(archive, 'w') as z:
            z.writestr('A/同名.md', '第一份内容')
            z.writestr('B/同名.md', '第二份内容')
            z.writestr('../不能越界.md', '第三份内容')
            z.writestr('重复.md', '第一份内容')
        records = intake(archive, root / 'project')
        assert len(records) == 3
        assert sum(len(s['duplicates']) for s in records) == 1
        assert not (root / '不能越界.md').exists()
        assert all((root / 'project' / r['path']).is_file() for r in records)
        try:
            intake(archive, root / 'project')
        except ValueError:
            pass
        else:
            raise AssertionError('Existing workspace was overwritten')
    demo = Path(__file__).resolve().parents[1] / 'assets/demo'
    valid = load(demo / 'knowledge.json')
    assert len(validate(deepcopy(valid), demo.resolve())['nodes']) == 3
    for mutate in (
        lambda data: data['nodes'][0].update(evidence='不存在的引文'),
        lambda data: data['sources'][0].update(text_file='../study.html'),
        lambda data: data['edges'][0].update(target='missing_card'),
        lambda data: data['sources'][0].update(original_path='C:/private/source.ppt'),
    ):
        data = deepcopy(valid)
        mutate(data)
        try:
            validate(data, demo.resolve())
        except ValueError:
            pass
        else:
            raise AssertionError('Invalid provenance or path was accepted')
    print('PASS: byte dedup, same-name variants, ZIP containment, source evidence and edge validation')


if __name__ == '__main__':
    main()
