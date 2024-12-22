import os
import json


def main():
    result = []

    all_ids = set()

    base_dir = "public/data"
    for filename in sorted(os.listdir(base_dir)):
        if filename.endswith(".json"):
            with open(os.path.join(base_dir, filename)) as f:
                puzzle = json.loads(f.read())
            puzzle["numShapes"] = len(puzzle["shapes"])
            for x in [
                "body",
                "vertices",
                "palette",
                "shapes",
                "displayDate",
                "slug",
                "purgatoryPuzzle",
            ]:
                if x in puzzle:
                    del puzzle[x]
            for x in ["puzzleConstructor", "date", "id"]:
                if x not in puzzle:
                    assert False, f"Missing {x} in {puzzle}"

            if puzzle["id"] in all_ids:
                assert False, f"Duplicate id {puzzle['id']}"

            result.append(puzzle)

    with open("src/puzzle-toc.json", "w") as f:
        f.write(json.dumps(result))


if __name__ == "__main__":
    main()
