import groovy.io.FileType

//Immediate return statement to prevent running builds
return;

library('sharedSpace'); // jenkins-pipeline-lib

def url = 'https://github.com/OpenSpace/OpenSpace';
//def branch = env.BRANCH_NAME;
def branch =  "master"

@NonCPS
def readDir() {
  def dirsl = [];
  new File("${workspace}").eachDir() {
    dirs -> println dirs.getName() 
    if (!dirs.getName().startsWith('.')) {
      dirsl.add(dirs.getName());
    }
  }
  return dirs;
}

def moduleCMakeFlags() {
  def modules = [];
  // using new File doesn't work as it is not allowed in the sandbox
  
  if (isUnix()) {
     modules = sh(returnStdout: true, script: 'ls -d modules/*').trim().split('\n');
  };
  else {
    modules = bat(returnStdout: true, script: '@dir modules /b /ad /on').trim().split('\r\n');
  }

  def flags = '';
  for (module in modules) {
      flags += "-DOPENSPACE_MODULE_${module.toUpperCase()}=ON "
  }
  return flags;
}

//
// Pipeline start
//
//hi micah
parallel linux_gcc_make: {
  if (env.USE_BUILD_OS_LINUX == 'true') {
    node('linux-visual') {
      // Just do an early return for now; this groovy script is not currently used
      return;
      stage('linux-gcc-make/scm') {
        deleteDir();
        gitHelper.checkoutGit(url, branch);
      }
      stage('linux-gcc-make/build') {
          def cmakeCompileOptions = moduleCMakeFlags();
          cmakeCompileOptions += ' -DCMAKE_BUILD_TYPE=Release -DCMAKE_CXX_FLAGS:STRING="-DGLM_ENABLE_EXPERIMENTAL"'
          cmakeCompileOptions += ' -DOpenGL_GL_PREFERENCE:STRING=GLVND -DASSIMP_BUILD_MINIZIP=1';
          cmakeCompileOptions += ' -DOPENSPACE_MODULE_VIDEO=OFF';
          cmakeCompileOptions += ' -DQT_DIR=/home/openspace/Qt6/6.3.1/gcc_64/lib/cmake/Qt6 ';
          cmakeCompileOptions += ' -DQt6_DIR=/home/openspace/Qt6/6.3.1/gcc_64/lib/cmake/Qt6 ';
          cmakeCompileOptions += ' -DQt6CoreTools_DIR=/home/openspace/Qt6/6.3.1/gcc_64/lib/cmake/Qt6CoreTools ';
          cmakeCompileOptions += ' -DQt6Core_DIR=/home/openspace/Qt6/6.3.1/gcc_64/lib/cmake/Qt6Core ';
          cmakeCompileOptions += ' -DQt6Network_DIR=/home/openspace/Qt6/6.3.1/gcc_64/lib/cmake/Qt6Network ';
          cmakeCompileOptions += ' -DQt6WidgetsTools_DIR=/home/openspace/Qt6/6.3.1/gcc_64/lib/cmake/Qt6WidgetsTools ';
          cmakeCompileOptions += ' -DQt6Widgets_DIR=/home/openspace/Qt6/6.3.1/gcc_64/lib/cmake/Qt6Widgets ';
          cmakeCompileOptions += ' -DQt6GuiTools_DIR=/home/openspace/Qt6/6.3.1/gcc_64/lib/cmake/Qt6GuiTools ';
          cmakeCompileOptions += ' -DQt6DBusTools_DIR=/home/openspace/Qt6/6.3.1/gcc_64/lib/cmake/Qt6DBusTools';
          compileHelper.build(compileHelper.Make(), compileHelper.Gcc(), cmakeCompileOptions, 'OpenSpace', 'build-make');
          compileHelper.recordCompileIssues(compileHelper.Gcc());
      }
      stage('linux-gcc-make/img-compare') {
        sh 'echo $(pwd) > ${buildFlag}'
        sh 'while [ 1 ]; do sleep 300; if [ "$(cat ${buildFlag})" = "" ]; then break; fi; done'
      }
      stage('linux-gcc-make/test') {
        // testHelper.runUnitTests('build/OpenSpaceTest');
        // testHelper.runUnitTests('bin/codegentest')
      }
      cleanWs()
    } // node('linux')
  }
},
windows_msvc: {
  if (env.USE_BUILD_OS_WINDOWS == 'true') {
    node('windows-visual') {
      stage('windows-msvc/scm') {
        deleteDir();
        gitHelper.checkoutGit(url, branch);
      }
      stage('windows-msvc/build') {
        compileHelper.build(compileHelper.VisualStudio(), compileHelper.VisualStudio(), moduleCMakeFlags(), '', 'build-msvc');
        compileHelper.recordCompileIssues(compileHelper.VisualStudio());
      }
      stage('windows-msvc/test') {
        buildFlag = System.getenv("buildFlag")
        File file = new File(buildFlag)
        file.write(new File(".").getAbsolutePath())
      }
      stage('windows/visual-tests') {
          dir('OpenSpace') {
            testHelper.linkFolder(env.OPENSPACE_FILES + "\\sync_full", "sync", );
            testHelper.linkFolder(env.OPENSPACE_FILES + "\\cache_gdal", "cache_gdal");
          }
          testHelper.startTestRunner();
          testHelper.runUiTests()
          //commit new test images
          //copy test results to static dir
      }
    }
  }
}
