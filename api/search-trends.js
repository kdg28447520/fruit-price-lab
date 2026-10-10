// Naver DataLab relative-interest index server integration.
module.exports=async(req,res)=>{
 if(req.method!=='GET')return res.status(405).json({ok:false});
 res.status(200).json({ok:false,configured:false,items:[],message:'네이버 데이터랩 연결 대기'});
};
