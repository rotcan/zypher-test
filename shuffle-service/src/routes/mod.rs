use rocket::serde::json::Json;
use crate::dto::shuffle::{RevealRequestData,RevealResponseData,RevealData};
use zshuffle::{wasm::*,utils::MaskedCard};
use rocket_okapi::openapi;
use std::collections::HashMap;

#[openapi(tag = "Reveal with snark")]
#[post("/reveal_with_snark",data="<input>")]
pub fn reveal_with_snark(input: Json<RevealRequestData>) -> Json<RevealResponseData> {
    init_reveal_key();
    let mut reveal_data_map: HashMap<usize,RevealData> = HashMap::new();
    for (key,value) in input.masked_card.iter() {
        let target=MaskedCard(value[0].clone(),
        value[1].clone(),
        value[2].clone(),
        value[3].clone());
        let snark_proof= reveal_card_with_snark(input.secret_key.clone(),target).expect("Failed to get proof");
        reveal_data_map.insert(*key,RevealData{card: snark_proof.card,
            snark_proof: snark_proof.snark_proof,});
    }
    
    //println!("snark_proof={:?}",snark_proof);

    Json(RevealResponseData {
        data:reveal_data_map
    })
}