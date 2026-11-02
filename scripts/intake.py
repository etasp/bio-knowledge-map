"""Copy teaching sources into a new workspace, deduplicating bytes, not names."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

SUPPORTED = {'.ppt', '.pptx', '.doc', '.docx', '.pdf', '.md', '.txt'}


def intake(source, output):
    source, output = Path(source).resolve(), Path(output).resolve()
    if not source.exists():
        raise ValueError('Input does not exist')
    if output.exists() and any(output.iterdir()):
        raise ValueError('Use a new, empty workspace to preserve existing source IDs')
    if source.is_dir() and (output == source or source in output.parents):
        raise ValueError('Workspace must be outside the input folder')
    output.mkdir(parents=True, exist_ok=True)
    (output / 'sources').mkdir()
    (output / 'corpus').mkdir()
    records, hashes = [], {}

    def add(name, payload):
        # Do not extract archive paths: every output name is generated locally.
        name = name.replace('\\', '/')
        base = name.rsplit('/', 1)[-1]
        suffix = Path(base).suffix.lower()
        if suffix not in SUPPORTED:
            return
        digest = hashlib.sha256(payload).hexdigest()
        if digest in hashes:
            hashes[digest]['duplicates'].append(name)
            return
        sid = f's{len(records) + 1:02d}'
        path = f'sources/{sid}{suffix}'
        (output / path).write_bytes(payload)
        record = dict(id=sid, name=base, original_path=name, path=path,
                      sha256=digest, size=len(payload), duplicates=[])
        records.append(record)
        hashes[digest] = record
        if suffix in {'.md', '.txt'}:
            text = payload.decode('utf-8-sig')
            (output / 'corpus' / f'{sid}.md').write_text(text, encoding='utf-8')

    if source.suffix.lower() == '.zip':
        with zipfile.ZipFile(source) as archive:
            for info in archive.infolist():
                if info.is_dir():
                    continue
                name = info.filename
                if not info.flag_bits & 0x800:
                    try:
                        name = name.encode('cp437').decode('gbk')
                    except UnicodeError:
                        pass
                if Path(name).suffix.lower() in SUPPORTED:
                    add(name, archive.read(info))
    elif source.is_dir():
        for path in sorted(source.rglob('*')):
            if path.is_file() and path.suffix.lower() in SUPPORTED:
                add(path.relative_to(source).as_posix(), path.read_bytes())
    elif source.suffix.lower() in SUPPORTED:
        add(source.name, source.read_bytes())
    else:
        raise ValueError('Input must be a source folder, supported file or ZIP')
    if not records:
        raise ValueError('No supported teaching sources found')
    (output / 'source_manifest.json').write_text(
        json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
    return records


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    records = intake(args.source, args.output)
    print(json.dumps(dict(sources=len(records), duplicates=sum(len(r['duplicates']) for r in records)), ensure_ascii=False))
