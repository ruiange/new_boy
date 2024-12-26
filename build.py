import PyInstaller.__main__

PyInstaller.__main__.run([
    'your_script.py',
    '--onefile',  # 打包成单个exe
    '--add-data', 'path/to/assets;assets',  # 添加资源文件
    '--hidden-import', 'needed_package',  # 添加可能需要的隐式导入
]) 