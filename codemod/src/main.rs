use std::{
    env,
    ffi::OsStr,
    fs::{File, OpenOptions},
    io::{Read, Write},
    os,
    process::Command,
};

use syn::__private::ToTokens;
use walkdir::WalkDir;

mod mods;

fn main() {
    let mut args = env::args();
    args.next();

    let path = args
        .next()
        .expect("Please specify a path as the first argument!");

    let current_dir = env::current_dir().expect("Error determining current directory!");

    for entry in WalkDir::new(&path) {
        let entry = match entry {
            Ok(entry) => entry,
            Err(err) => {
                println!("Error: {}", err);
                continue;
            }
        };

        if entry.path().extension() == Some(OsStr::new("rs")) {
            let src = {
                let mut file = match File::open(entry.path()) {
                    Ok(file) => file,
                    Err(err) => {
                        println!("Error opening file '{}': {err}", entry.path().display());
                        continue;
                    }
                };

                let mut src = String::new();
                match file.read_to_string(&mut src) {
                    Ok(_) => {}
                    Err(err) => {
                        println!("Error reading file '{}': {err}", entry.path().display());
                        continue;
                    }
                };
                src
            };

            let syntax = match syn::parse_file(&src) {
                Ok(syntax) => syntax,
                Err(err) => {
                    println!("Error parsing file '{}': {err}", entry.path().display());
                    continue;
                }
            };

            let syntax = mods::use_specta_exports(syntax);

            let mut file = match OpenOptions::new()
                .write(true)
                .truncate(true)
                .open(entry.path())
            {
                Ok(file) => file,
                Err(err) => {
                    println!(
                        "Error opening to save file '{}': {err}",
                        entry.path().display()
                    );
                    continue;
                }
            };

            match file.write_all(syntax.to_token_stream().to_string().as_bytes()) {
                Ok(_) => {}
                Err(err) => {
                    println!("Error writing to file '{}': {err}", entry.path().display());
                    continue;
                }
            }

            match Command::new("rustfmt")
                .arg("--edition=2021")
                // .arg(entry.path())
                .arg(entry.path().to_str().unwrap())
                .current_dir(&current_dir)
                .output()
            {
                Ok(a) => {
                    println!("{:?} {:?}", a.stderr, a.stdout)
                }
                Err(err) => {
                    println!(
                        "Error running rustfmt on file '{}': {err}",
                        entry.path().display()
                    );
                    continue;
                }
            }

            println!("Processed: {}", entry.path().display());
        }
    }
}

// fn new_procedure_syntax() {}
