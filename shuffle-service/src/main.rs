#[macro_use]
extern crate rocket;

use rocket_okapi::{
    openapi_get_routes,
    swagger_ui::{make_swagger_ui, SwaggerUIConfig},
};

mod dto;
mod routes;
mod fairings;

#[launch]
fn rocket() -> _ {
    //dotenv().ok();
    rocket::build()
        //.attach(db::init())
        .attach(fairings::cors::Cors)
        .mount(
            "/",
            openapi_get_routes![
                routes::reveal_with_snark,
            ],
        )
        .mount(
            "/api-docs",
            make_swagger_ui(&SwaggerUIConfig {
                url: "../openapi.json".to_owned(),
                ..Default::default()
            }),
        )
}
