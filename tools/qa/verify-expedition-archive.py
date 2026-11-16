"""Compare a locally built Sites archive with the frozen tested runtime."""
import hashlib
import json
import pathlib
import sys
import tarfile

manifest_path, archive_path, result_path = map(pathlib.Path, sys.argv[1:4])
manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
expected = {item["path"]: item["sha256"] for item in manifest["files"] if item["path"].startswith("dist/")}
seen = {}
hosting = None
with tarfile.open(archive_path, "r:*") as archive:
    for item in archive.getmembers():
        if not item.isfile():
            continue
        name = item.name.removeprefix("./")
        if name in seen:
            raise RuntimeError(f"Duplicate archive file: {name}")
        stream = archive.extractfile(item)
        assert stream is not None
        data = stream.read()
        if name == "dist/.openai/hosting.json":
            hosting = json.loads(data)
            continue
        if name not in expected:
            raise RuntimeError(f"Unexpected archive file: {name}")
        seen[name] = hashlib.sha256(data).hexdigest()
if seen != expected:
    mismatches = sorted(set(expected) - set(seen)) + [name for name in seen if seen[name] != expected[name]]
    raise RuntimeError(f"Archive differs from tested dist: {mismatches}")
if not hosting or hosting.get("project_id") != "appgprj_6af888133e4c8191927dcd3d3efc387f":
    raise RuntimeError("Archive hosting identity is missing or changed")
result = {"archive": str(archive_path.resolve()), "archiveSha256": hashlib.sha256(archive_path.read_bytes()).hexdigest(), "matchedDistFiles": len(seen), "hostingProjectId": hosting["project_id"], "verdict": "exact tested dist bytes plus helper hosting manifest"}
result_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps({"matchedDistFiles": len(seen), "verdict": result["verdict"]}))
