import logging
import json
from queue import Empty
import time
from datetime import datetime

def get_msg_type(type_id):
    """将消息类型ID转换为可读的中文描述"""
    msg_types = {
        1: "文本消息",
        3: "图片消息",
        34: "语音消息",
        43: "视频消息",
        47: "表情消息",
        49: "应用消息",
        10000: "系统消息"
    }
    return msg_types.get(type_id, f"未知类型({type_id})")

def listen_for_messages(wcf):
    """监听消息并打印消息详情"""
    logging.info("消息监听已启动，等待新消息...")

    while True:
        try:
            # 获取消息
            msg = wcf.get_msg()

            if msg:
                # 获取当前时间
                current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                # 打印消息详情
                logging.info("\n" + "="*50)
                logging.info("收到新消息:")
                logging.info(f"时间: {current_time}")
                
                # 如果是群消息，先显示群ID
                if msg.roomid:
                    logging.info(f"群ID: {msg.roomid}")
                
                logging.info(f"发送者: {msg.sender}")
                logging.info(f"消息类型: {get_msg_type(msg.type)}")
                logging.info(f"消息内容: {msg.content}")
                logging.info("="*50 + "\n")

        except Empty:
            time.sleep(0.5)
            continue

        except KeyboardInterrupt:
            logging.info("消息监听已停止")
            break

        except Exception as e:
            logging.error(f"消息监听出错: {str(e)}")
            time.sleep(1)
            continue 