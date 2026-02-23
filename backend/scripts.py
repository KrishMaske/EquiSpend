import ast, sys, pathlib

p = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
imports = set()
for fp in p.rglob("*.py"):
    try:
        tree = ast.parse(fp.read_text(encoding="utf-8"))
    except Exception:
        continue
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for n in node.names:
                imports.add(n.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                imports.add(node.module.split(".")[0])
print("\n".join(sorted(imports)))