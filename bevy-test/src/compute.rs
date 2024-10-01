use bevy::prelude::*;
use async_channel::{unbounded, Receiver, Sender};
use bevy::tasks::{AsyncComputeTaskPool};
use crate::test_snark;

#[derive(Debug)]
pub enum ComputeChannelCmd {
    ComputeResult{
        result: Option<String>,
        // error: Option<String> 
    },
}
 
#[derive(Resource,Debug)]
pub struct ComputeChannelResource{
    compute_tx: Sender<ComputeChannelCmd>,
    compute_rx: Receiver<ComputeChannelCmd>,
}

#[derive(Debug,Clone)]
pub struct ComputeResultResponse{
    pub result: Option<String>,
}

type ComputeResult<T> = Result<T, String>;

pub fn init_compute_resource()->ComputeChannelResource{
    let (compute_tx,compute_rx)=unbounded();

    ComputeChannelResource{
        compute_tx,
        compute_rx,
    }
}

impl  ComputeChannelResource{

    pub fn process_async_task(&self){
        let tx=self.compute_tx.clone();
        AsyncComputeTaskPool::get()
        .spawn(
            async move {
            let result = test_snark();
            println!("inside async task");
            let _ = tx.send(ComputeChannelCmd::ComputeResult{
                //result:Some(ret_type.parse_data(result)),
                result: Some(result),
                // error:None,
            }).await;
            
        }).detach();
        //
    }

    pub fn recv_compute(&self)->ComputeResult<ComputeResultResponse,>{
        match self.compute_rx.try_recv(){
            Ok(ComputeChannelCmd::ComputeResult{result,..})=>{
                if let Some(result) = result  {
                    Ok(ComputeResultResponse{
                        result: Some(result),
                    })
                }else{
                    Err("failed".into())
                }
            },
            Err(err)=>match err{
                async_channel::TryRecvError::Empty=>{Err("empty".into())},
                _=>{Err("closed".into())}
            }
        }
    }
}