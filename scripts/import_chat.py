"""Normalize a single-conversation JSON/JSONL/CSV export without deleting messages."""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import shutil

ALIASES = {'id': ('id', 'msg_id', 'message_id'), 'author': ('sender', 'author', 'sender_name'),
           'time': ('timestamp', 'time', 'create_time'), 'text': ('content', 'text', 'raw_content')}


def import_chat(source, output, fields=None):
    source, output = Path(source).resolve(), Path(output).resolve()
    payload = source.read_bytes()
    text = payload.decode('utf-8-sig')
    if source.suffix.lower() == '.csv':
        messages = list(csv.DictReader(io.StringIO(text)))
    elif source.suffix.lower() == '.jsonl':
        messages = [json.loads(line) for line in text.splitlines() if line.strip()]
    elif source.suffix.lower() == '.json':
        messages = json.loads(text)
        if isinstance(messages, dict):
            messages = messages.get('messages')
    else:
        raise ValueError('Use a UTF-8 JSON, JSONL or CSV export of one conversation')
    if not isinstance(messages, list) or not messages:
        raise ValueError('Expected nonempty message list; unsupported export format')
    text_fields = [fields['text']] if fields and fields.get('text') else ALIASES['text']
    if not any(isinstance(message, dict) and any(key in message for key in text_fields) for message in messages):
        raise ValueError('No recognized message text field; use --text-field for this export')
    lines = ['# 聊天原文', '', '本次导入定位编号不替代原消息ID；缺失字段未推测补全。', '']
    missing = dict(id=0, author=0, time=0, text=0)
    for index, message in enumerate(messages, 1):
        if not isinstance(message, dict):
            raise ValueError(f'Message {index} must be an object')
        values = {}
        for key, aliases in ALIASES.items():
            candidates = [fields[key]] if fields and fields.get(key) else aliases
            value = next((message[k] for k in candidates if message.get(k) not in (None, '')), None)
            if value is None:
                missing[key] += 1
                value = '未提供' if key != 'text' else '[无文本正文；附件和原始内容见导出文件]'
            if not isinstance(value, (str, int, float)):
                if key == 'text':
                    value = '[非文本正文，未识别；原始内容见导出文件]'
                else:
                    raise ValueError(f'Message {index}: map {key} to a flat string/number field')
            values[key] = str(value)
        number = f'D{index:06d}'
        # Metadata remains literal source text; no inference about identity or time zone.
        lines += [f'## {number}｜{values["time"]}｜{values["author"]}',
                  f'原消息ID：{values["id"]}', '', values['text'], '']
    if output.exists() and any(output.iterdir()):
        raise ValueError('Use a new empty workspace; existing records were not changed')
    (output / 'sources').mkdir(parents=True, exist_ok=True)
    (output / 'corpus').mkdir()
    suffix = source.suffix.lower()
    shutil.copy2(source, output / 'sources' / ('s01' + suffix))
    (output / 'corpus/s01.md').write_text('\n'.join(lines), encoding='utf-8')
    manifest = [dict(id='s01', name=source.name, original_path=source.name,
                     path='sources/s01' + suffix, sha256=hashlib.sha256(payload).hexdigest(),
                     size=len(payload), kind='chat', messages=len(messages), missing_fields=missing)]
    (output / 'source_manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    return manifest[0]


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    for field in ALIASES:
        parser.add_argument(f'--{field}-field')
    args = parser.parse_args()
    fields = {field: getattr(args, field + '_field') for field in ALIASES}
    print(json.dumps(import_chat(args.source, args.output, fields), ensure_ascii=False))
