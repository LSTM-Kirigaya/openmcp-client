<template>
	<div class="about-container">

        <span>
            <img src="/images/openmcp.svg" alt="">
        </span>

		<p>
			OpenMCP Client 0.0.1 由 OpenMCP@<a href="https://www.zhihu.com/people/can-meng-zhong-de-che-xian">锦恢</a> 开发
		</p>
		
		<p>
			软件已开源 <a href="https://github.com/LSTM-Kirigaya/openmcp-client" target="_blank">
			LSTM-Kirigaya/openmcp-client
			</a>
			<br>
			请遵循开源协议进行分发和二次开发。
		</p>

		<p>
			如果感兴趣，欢迎加入我们的QQ群和我们讨论
		</p>
		<el-button
			class="join-qq"
			type="primary"
			@click="joinQQGroup('https://qm.qq.com/cgi-bin/qm/qr?k=C6ZUTZvfqWoI12lWe7L93cWa1hUsuVT0&jump_from=webapi&authKey=McW6B1ogTPjPDrCyGttS890tMZGQ1KB3QLuG4aqVNRaYp4vlTSgf2c6dMcNjMuBD')"
		>
			<span class="iconfont icon-QQ"></span>
			加入 OpenMCP 技术群
		</el-button>
	</div>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue';

defineComponent({ name: 'about' });

function joinQQGroup(url: string) {
	window.open(url, '_blank');
}

</script>

<style>
.about-container {
    text-align: center;
    height: 90%;
    display: flex;
    align-items: center;
    flex-direction: column;
    justify-content: center;
}

.about-container > span > img {
	height: 150px;
	width: 150px;
}

.about-container > .qr-code {
  height: 180px;
  border: 2px solid transparent; /* 设置边框宽度，但颜色透明 */
  border-image: linear-gradient(to bottom right, #7DDCEB, #CB81DA);
  border-image-slice: 1; /* 确保渐变覆盖整个边框 */
  background: white; /* 可选：防止内容穿透 */
}

.join-qq .iconfont {
	font-size: 20px;
	margin-right: 6px;
}

</style>