use rocket::fairing::{Fairing, Info, Kind};
use rocket::http::{Header,Status,ContentType,Method};
use rocket::{Request, Response};

pub struct Cors;

#[rocket::async_trait]
impl Fairing for Cors {
    fn info(&self) -> Info {
        Info {
            name: "Add CORS headers to responses",
            kind: Kind::Response,
        }
    }

    async fn on_response<'r>(&self, request: &'r Request<'_>, response: &mut Response<'r>) {
        response.set_header(Header::new("Access-Control-Allow-Origin", "*"));
        response.set_header(Header::new(
            "Access-Control-Allow-Methods",
            "POST, GET, PATCH, OPTIONS",
        ));
        response.set_header(Header::new("Access-Control-Allow-Headers", "*"));
        response.set_header(Header::new("Access-Control-Allow-Credentials", "true"));

        if request.method() == Method::Options {
            let body = "";
            response.set_header(ContentType::Plain);
            response.set_sized_body(body.len(), std::io::Cursor::new(body));
            response.set_status(Status::Ok);
        }
    }
}