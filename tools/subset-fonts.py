"""Rebuild locally hosted OFL font subsets after changing UI copy.
Full source TTF files are in tools/font-sources (downloaded from Google Fonts).
Requires fontTools. No network is used while the game runs.
"""
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
root=Path(__file__).resolve().parents[1]
chars=set(chr(i) for i in range(32,256))
for p in (root/'src').rglob('*'):
    if p.suffix in ('.ts','.css'):
        chars.update(p.read_text(encoding='utf-8'))
for p in (root/'tools/font-sources').glob('*.ttf'):
    font=TTFont(p)
    options=subset.Options()
    options.flavor='woff'
    selected=subset.Subsetter(options=options)
    selected.populate(text=''.join(chars))
    selected.subset(font)
    font.flavor='woff'
    font.save(root/'public/assets/fonts'/(p.stem+'.woff'))
print(f'Font subset: {len(chars)} characters')
