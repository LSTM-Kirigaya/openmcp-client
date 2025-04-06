import requests as r
import os
import shutil
import zipfile

# 下载 压缩包
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    'Cookie': 'xlly_s=1; cna=w4NlIMtvvVIBASQIgABnZxfD; ctoken=JAiIJ8vTLxVkJt4qnZXDbFu9; EGG_SESS_ICONFONT=Hu68kBY7XO7C6Udp3T99M1asKmUZ0gxjps8xjTrjx4aHaXwoIsDX25rpXZ2zp9tczibClyXdTQqv_kqXliYYccYUbU71pFxGJk2xcwvM-zixNt2D1jY18fYU0XW7DKzBelbgH7j20AOrp4NLnMCAeGGF8hsAMlq5eWwF7izXpY3df-y9RcoBvEmhZuOznUH_DidmM3uCXNeIeXB5w23A_FKndHS05gh2an7VfBF_MsfGIt1-j1XoeoDfbGhU2if_M9__TVNxMUtQQA_geOKrz1NByAcdO-kMa_ZXF40_Loc=; u=10114852; u.sig=mv5vi-TPPlhvQJi2PMIC4VoPpD03Wc9UykMTMiG6ElA; iconfont_has_read_tip=1; tfstk=gjCqKobIJCjW5bf4jUAZUBhcX1OvtIqCs1t6SNbMlnxmGjiGUis9cda9GO8M4Gp6mZwAQCShYnbf5lhZSIC5hftbDC7GACrQAWNCkZdJskZBiNwwJBYpSqm6mQ0k1F-fVxgPkZdty4igdTbxbcWuRZAGjQvk7FOMoFcgz4YBqjYiiFmuzFKksEAinLVkSFiMjjjGrz89qhAMnffPoNcyRK4a-KNkQlOJ3HbD4X7RaE2DYWKosrCkua-hoAhis_8231EQoCOXstbf4p64YjROo9I9-im00U5V81Whq7G2_aXh_Qfuq4tcpa5wGs4_iQfV0svPjVE9y9TF7p67Sv-5IaCyUsyIWUCfSspBtWnDfT_F_F5TX7SFoiWHKsmV4Zi9rSNR6toiQKYJzHazzEw6XK1Rl5FjBApk9U-QlEMtBKxBzHacIAH9H28yArTf.',
    'Pragma': 'no-cache',
    'sec-fetch-mode': 'navigate'
}

url = 'https://www.iconfont.cn/api/project/download.zip?spm=a313x.manage_type_myprojects.i1.d7543c303.277c3a81v3P5sL&pid=4870215&ctoken=JAiIJ8vTLxVkJt4qnZXDbFu9'
res = r.get(url, headers=headers)

if res.status_code:
    with open('./scripts/tmp.zip', 'wb') as fp:
        fp.write(res.content)

# 解压文件
with zipfile.ZipFile('./scripts/tmp.zip', 'r') as zipf:
    zipf.extractall('./scripts/tmp')

# 将文件搬运至工作区，我的 css 全放在 public 下面了，你的视情况而定
for parent, _, files in os.walk('./scripts/tmp'):
    for file in files:
        filepath = os.path.join(parent, file)
        if file.startswith('demo'):
            continue
        if file.endswith('.css'):
            content = open(filepath, 'r', encoding='utf-8').read().replace('font-size: 16px;', '')
            open(filepath, 'w', encoding='utf-8').write(content)
            shutil.move(filepath, os.path.join('./public', file))
        elif file.endswith('.woff2'):
            shutil.move(filepath, os.path.join('./public', file))

# 删除压缩包和解压区域
os.remove('./scripts/tmp.zip')
shutil.rmtree('./scripts/tmp')