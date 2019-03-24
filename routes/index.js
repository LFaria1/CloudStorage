var express = require('express');
var router = express.Router();
var formidable =require("formidable");
var fs = require("fs");


router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.post('/upload',(req,res)=>{
  let form =new formidable.IncomingForm({
    uploadDir:"./upload",
    keepExtensions:true,
    maxFileSize:'2 * 1024 * 1024 * 1024 ' //necessário pois o limite padrão é de ~100mb
  });

  form.parse(req,(err,fields,files)=>{
    console.log(form.maxFileSize);   
    res.json({fon:files});
  });

});

router.get("/file",(req,res)=>{  
  let path =req.query.path;
  //fs.exists(path,callback(){});
  if(fs.existsSync(path)){
    fs.readFile(path,(err,data)=>{
      if(err){
        console.error(err);
        res.status(400).json({
          error:err
        });
      }else{
        
      }
    });
  }else{
    res.status(404).json({error:"file not found"});
  }
});

router.delete("/file",(req,res)=>{
  let form=new formidable.IncomingForm();
  form.parse(req,(err,fields,files)=>{    
    let path ="./"+fields.url;
    console.log(fields);
    //putamerda
    fs.unlink(path,err=>{
      if(err){        
        res.status(400).json({err});
      }else{
      res.json({fields});
      }
    });
});

});

module.exports = router;
