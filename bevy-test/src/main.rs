use bevy::prelude::*;
use zshuffle::{wasm::*,utils::{MaskedCard,}};

fn main() {
    App::new()
        .add_plugins(DefaultPlugins)
        .add_systems(Startup,test_snark)
        .run();
}



fn test_snark() {
    //Test
    info!("testing snarks");
    init_prover_key(20).unwrap();
    refresh_joint_key("0x9723835eb88d3c9e76f6d0c1295724e4f76fd0762568dee9a79394760510659d".to_owned(),20).unwrap();
    let target=MaskedCard("0x0bbb65c1461f6b6622f4fcc71f24eca08df3789e4318c1d1f23628a73839d852".to_owned(),
    "0x2bac4f082c8e1482be425cc89eaf2d347b51aded2901937e6e7bfd0131b14ee2".to_owned(),
    "0x0139327aac5ec9067c9509587200e581a7b86c3a0338607b62ee8853bf2ee48f".to_owned(),
    "0x20057633ca7fab6c6834ec0d5bf96f8149c061027ecf0dee6c81777a0076c3a9".to_owned());
    init_reveal_key();
    let _snark_proof= reveal_card_with_snark("0x020b31a672b203b71241031c8ea5e5a4ef133c57bcde822ac514e8a1c7f89124".to_owned()
    ,target).expect("Failed to get proof");
   
}
