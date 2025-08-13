import os
from utils import copy_corpus_files, get_edit, apply_morph_edit, write_new_file


CORPUS_DIR = "corpus/"
WORKSPACE_DIR = "workspace/"
Q = "Add a simple console.log statement at the beginning of the render method that logs 'Day component rendering' to help with debugging."


def main():
    if not os.path.exists(CORPUS_DIR):
        print(f"Corpus directory '{CORPUS_DIR}' does not exist.")
        return

    # delete the workspace directory if it exists
    if os.path.exists(WORKSPACE_DIR):
        os.system(f"rm -rf {WORKSPACE_DIR}")

    os.makedirs(WORKSPACE_DIR, exist_ok=True)

    copy_corpus_files(CORPUS_DIR, WORKSPACE_DIR)

    # hardcode read file for now

    with open(os.path.join(WORKSPACE_DIR, "day.tsx"), "r") as f:
        file_contents = f.read()

    edit = get_edit(file_contents, Q, "morph")
    edited_content = apply_morph_edit(edit, file_contents)

    # Write the edited content to a new file in the workspace
    write_new_file(edited_content, "day_edited.tsx", WORKSPACE_DIR)


if __name__ == "__main__":
    main()
