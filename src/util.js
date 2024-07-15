const adm_zip = require("adm-zip");

module.exports = {
  zip(sourcePath, targetPath) {
    // 把所有编译好的代码打包，方便上传
    var zip = new adm_zip();
    zip.addLocalFolder(sourcePath);
    zip.writeZip(targetPath, function (error) {
      if (error) {
        console.log('发生错误:', error)
      } else {
        console.log('创建成功:')
      }
    });
  },
};
