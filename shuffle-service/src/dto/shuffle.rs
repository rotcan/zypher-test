use serde::{Deserialize,Serialize};
use schemars::JsonSchema;
use std::collections::HashMap;

//#[derive(Deserialize,Serialize,Clone,Debug,JsonSchema)]
//pub struct MaskedCard(pub String,pub String,pub String,pub String);

#[derive(Deserialize,Serialize,Clone,Debug,JsonSchema)]
pub struct RevealRequestData{
    pub secret_key: String,
    pub masked_card: HashMap<usize,Vec<String>>,
}


#[derive(Serialize, Deserialize,Clone,Debug,JsonSchema)]
pub struct RevealData {
    pub card: (String, String),
    pub snark_proof: Vec<String>,
}
 
#[derive(Serialize, Deserialize,Clone,Debug,JsonSchema)]
pub struct RevealResponseData {
    pub data: HashMap<usize,RevealData>,
}
