Not built. Concept only.

# Finer terrain cells

`cell` is an integer today. It must divide the width, the height and 1000 (125, 100, 50, 25). The default is 125.

A cell of 62.5 is not allowed. It needs a finer fixed point for vertex positions and for `heightAt`. Until then, 50 or 25 is the finest option.
