use syn::{Item, ItemUse, UseTree};

pub fn use_specta_exports(file: syn::File) -> syn::File {
    let imports = file.items.iter().filter_map(|i| match i {
        Item::Use(i) => Some(i),
        _ => None,
    });

    // for import in imports {
    //     fix_import(&import.tree);
    // }

    file
}

fn fix_import(item: &UseTree) {
    match &item {
        UseTree::Path(path) => {
            if path.ident == "rspc" {
                println!("Path: {:?}", path.tree);
            }
        }
        UseTree::Name(name) => {}
        UseTree::Rename(rename) => {}
        UseTree::Glob(glob) => {}
        UseTree::Group(group) => {
            for item in &group.items {
                fix_import(item);
            }
        }
    }
}
