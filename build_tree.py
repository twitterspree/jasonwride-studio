import json
from pathlib import Path

OUTPUT_JSON = Path("src/data/tree.json")
TRAITS_JSON = Path("src/data/traits.json")

tree_data = {
    "name": "LUCA",
    "traits": [],
    "children": [
        {
            "name": "Bacteria",
            "traits": [],
            "children": [
                {"name": "Cyanobacteria", "traits": ["photosynthesis"]},
                {"name": "Bioluminescent Vibrio", "traits": ["bioluminescence"]}
            ]
        },
        {
            "name": "Eukarya",
            "traits": [],
            "children": [
                {
                    "name": "Plants",
                    "traits": ["photosynthesis"],
                    "children": [
                        {"name": "Mosses", "traits": []},
                        {"name": "Ferns", "traits": []},
                        {"name": "Flowering Plants", "traits": []}
                    ]
                },
                {
                    "name": "Fungi",
                    "traits": [],
                    "children": [
                        {"name": "Yeast", "traits": []},
                        {"name": "Ghost Fungus", "traits": ["bioluminescence"]},
                        {"name": "Cordyceps", "traits": []}
                    ]
                },
                {
                    "name": "Animals",
                    "traits": [],
                    "children": [
                        {
                            "name": "Cnidarians",
                            "traits": ["venom"],
                            "children": [
                                {"name": "Jellyfish", "traits": ["bioluminescence"]},
                                {"name": "Sea Anemones", "traits": []}
                            ]
                        },
                        {
                            "name": "Arthropods",
                            "traits": [],
                            "children": [
                                {
                                    "name": "Insects",
                                    "traits": [],
                                    "children": [
                                        {"name": "Flies", "traits": ["flight"]},
                                        {"name": "Fireflies", "traits": ["flight", "bioluminescence"]},
                                        {"name": "Honeybees", "traits": ["flight", "eusociality", "venom"]},
                                        {"name": "Ants", "traits": ["eusociality", "venom"]}
                                    ]
                                },
                                {
                                    "name": "Arachnids",
                                    "traits": ["venom"],
                                    "children": [
                                        {"name": "Spiders", "traits": ["silk_production"]},
                                        {"name": "Scorpions", "traits": []}
                                    ]
                                }
                            ]
                        },
                        {
                            "name": "Mollusks",
                            "traits": [],
                            "children": [
                                {
                                    "name": "Cephalopods",
                                    "traits": ["camera_eye"],
                                    "children": [
                                        {"name": "Octopuses", "traits": ["tool_use", "venom"]},
                                        {"name": "Bioluminescent Squid", "traits": ["bioluminescence"]}
                                    ]
                                },
                                {
                                    "name": "Gastropods",
                                    "traits": [],
                                    "children": [
                                        {"name": "Cone Snails", "traits": ["venom"]},
                                        {"name": "Garden Snails", "traits": []}
                                    ]
                                }
                            ]
                        },
                        {
                            "name": "Vertebrates",
                            "traits": ["camera_eye"],
                            "children": [
                                {
                                    "name": "Fishes",
                                    "traits": [],
                                    "children": [
                                        {"name": "Sharks", "traits": ["electroreception"]},
                                        {"name": "Electric Eels", "traits": ["electroreception"]},
                                        {"name": "Anglerfish", "traits": ["bioluminescence"]}
                                    ]
                                },
                                {
                                    "name": "Reptiles & Birds",
                                    "traits": [],
                                    "children": [
                                        {"name": "Vipers", "traits": ["venom"]},
                                        {"name": "Falcons", "traits": ["flight"]},
                                        {"name": "Crows", "traits": ["flight", "tool_use"]}
                                    ]
                                },
                                {
                                    "name": "Mammals",
                                    "traits": [],
                                    "children": [
                                        {"name": "Platypus", "traits": ["electroreception", "venom"]},
                                        {"name": "Bats", "traits": ["flight", "echolocation"]},
                                        {"name": "Dolphins", "traits": ["echolocation", "tool_use"]},
                                        {"name": "Chimpanzees", "traits": ["tool_use"]},
                                        {"name": "Humans", "traits": ["tool_use"]}
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
}

def collect(node, traits, names):
    traits.update(node.get("traits", []))
    names.append(node["name"])
    for child in node.get("children", []):
        collect(child, traits, names)


def validate(tree):
    """Fail loudly if the tree and the trait write-ups drift apart."""
    traits, names = set(), []
    collect(tree, traits, names)

    dupes = {n for n in names if names.count(n) > 1}
    if dupes:
        raise SystemExit(f"Duplicate node names: {sorted(dupes)}")

    described = set(json.loads(TRAITS_JSON.read_text(encoding="utf-8")))
    if missing := traits - described:
        raise SystemExit(f"Traits missing from {TRAITS_JSON}: {sorted(missing)}")
    if unused := described - traits:
        print(f"Warning: {TRAITS_JSON} describes traits not in the tree: {sorted(unused)}")


def main():
    validate(tree_data)
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(tree_data, f, indent=2)
    print(f"Expanded tree data generated at {OUTPUT_JSON}")

if __name__ == "__main__":
    main()