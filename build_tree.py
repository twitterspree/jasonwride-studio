import json
from pathlib import Path

# The output destination in your Astro project
OUTPUT_JSON = Path("src/data/tree.json")

# Our mock hierarchical data, focusing on convergent traits
tree_data = {
    "name": "LUCA (Last Universal Common Ancestor)",
    "traits": [],
    "children": [
        {
            "name": "Eukarya",
            "traits": [],
            "children": [
                {
                    "name": "Animals",
                    "traits": [],
                    "children": [
                        {
                            "name": "Vertebrates",
                            "traits": ["spinal_cord"],
                            "children": [
                                {"name": "Humans", "traits": ["camera_eye", "limbs", "brain"]},
                                {"name": "Birds", "traits": ["camera_eye", "limbs", "flight", "brain"]}
                            ]
                        },
                        {
                            "name": "Mollusks",
                            "traits": [],
                            "children": [
                                {"name": "Octopuses", "traits": ["camera_eye", "limbs", "brain"]},
                                {"name": "Snails", "traits": ["shell"]}
                            ]
                        },
                        {
                            "name": "Arthropods",
                            "traits": ["exoskeleton"],
                            "children": [
                                {"name": "Flies", "traits": ["compound_eye", "flight", "limbs"]},
                                {"name": "Fireflies", "traits": ["compound_eye", "flight", "limbs", "bioluminescence"]}
                            ]
                        }
                    ]
                },
                {
                    "name": "Fungi",
                    "traits": [],
                    "children": [
                        {"name": "Ghost Fungus", "traits": ["bioluminescence"]},
                        {"name": "Yeast", "traits": []}
                    ]
                }
            ]
        }
    ]
}

def main():
    # Ensure the data directory exists
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    
    # Write the hierarchical structure to a JSON file
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(tree_data, f, indent=2)
        
    print(f"Successfully built evolutionary tree data at {OUTPUT_JSON}")

if __name__ == "__main__":
    main()