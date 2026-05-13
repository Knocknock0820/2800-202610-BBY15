/* I did get help from  a youtube videos
these is the link to it 
https://youtu.be/XCRUzPi0X0Q?si=NGmAHzTDTEnwBmwK
https://youtu.be/pfxd7L1kzio?si=dhmzaYL7XSshkJpL

ALL the code is handwritten by Shivika Kapoor
Might use AI for debugging :(
had to use Ai for help with debugging and problem solving
*/
//Base64 is the easiest way 
//Base64 in the route and saved directly to MongoDB.

//writting this code is making me hungry i better get paid overtime

const multer = require("multer");
const path = require("path");

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {fileSize: 5 * 1024 * 1024 }, // making it 5mb max slayy
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png/;
        const valid = allowed.test(path.extname(file.originalname).toLowerCase());
        cb(null, valid);
    
    },


});

module.exports = upload;