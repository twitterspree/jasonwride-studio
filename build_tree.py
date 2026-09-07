import json
from pathlib import Path

OUTPUT_JSON = Path("src/data/tree.json")

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

def main():
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(tree_data, f, indent=2)
    print(f"Expanded tree data generated at {OUTPUT_JSON}")

if __name__ == "__main__":
    main()