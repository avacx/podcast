#!/usr/bin/env python3
"""
本地Faster-Whisper转录脚本
支持单文件和批量转录
"""

import sys
import json
import argparse
import time
from pathlib import Path
from faster_whisper import WhisperModel

class LocalWhisperTranscriber:
    def __init__(self, model_size="base", device="cpu", compute_type="int8"):
        """
        初始化Faster-Whisper模型
        
        Args:
            model_size: 模型大小 ("tiny", "base", "small", "medium", "large-v3")
            device: 设备类型 ("cpu", "cuda")
            compute_type: 计算类型 ("int8", "int16", "float16", "float32")
        """
        print(f"🔄 正在加载Whisper模型: {model_size}", file=sys.stderr)
        self.model = WhisperModel(model_size, device=device, compute_type=compute_type)
        print(f"✅ 模型加载完成", file=sys.stderr)

    def transcribe_file(self, audio_path, language=None):
        """
        转录单个音频文件
        
        Args:
            audio_path: 音频文件路径
            language: 指定语言 (None为自动检测)
        
        Returns:
            dict: 转录结果
        """
        try:
            print(f"🎤 开始转录: {audio_path}", file=sys.stderr, flush=True)
            start_time = time.time()
            
            # 执行转录
            segments, info = self.model.transcribe(
                audio_path, 
                language=language,
                vad_filter=True,  # 启用语音活动检测
                vad_parameters=dict(min_silence_duration_ms=500)
            )
            
            # 收集所有片段
            transcript_segments = []
            full_text = ""
            segment_count = 0
            
            for segment in segments:
                segment_dict = {
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment.text.strip()
                }
                transcript_segments.append(segment_dict)
                full_text += segment.text.strip() + " "
                
                # 每处理 10 个片段输出一次进度
                segment_count += 1
                if segment_count % 10 == 0:
                    print(f"⏳ 已处理 {segment_count} 个片段，当前时间点: {segment.end:.1f}秒", file=sys.stderr, flush=True)
            
            duration = time.time() - start_time
            
            result = {
                "success": True,
                "file": str(audio_path),
                "text": full_text.strip(),
                "segments": transcript_segments,
                "language": info.language,
                "language_probability": info.language_probability,
                "duration": info.duration,
                "processing_time": round(duration, 2)
            }
            
            print(f"✅ 转录完成: {duration:.1f}秒，共 {segment_count} 个片段", file=sys.stderr, flush=True)
            return result
            
        except Exception as e:
            error_result = {
                "success": False,
                "file": str(audio_path),
                "error": str(e),
                "text": ""
            }
            print(f"❌ 转录失败: {e}", file=sys.stderr, flush=True)
            return error_result

    def transcribe_multiple(self, audio_paths, language=None):
        """
        批量转录多个音频文件
        
        Args:
            audio_paths: 音频文件路径列表
            language: 指定语言
        
        Returns:
            list: 转录结果列表
        """
        results = []
        total_files = len(audio_paths)
        
        print(f"📄 开始批量转录 {total_files} 个文件", file=sys.stderr)
        
        for i, audio_path in enumerate(audio_paths, 1):
            print(f"🎵 处理文件 {i}/{total_files}: {Path(audio_path).name}", file=sys.stderr)
            result = self.transcribe_file(audio_path, language)
            results.append(result)
        
        return results

def format_transcript_as_markdown(transcript_text, podcast_title=None, original_filename=None, source_url=None):
    """
    将转录文本格式化为Markdown
    
    Args:
        transcript_text: 原始转录文本
        podcast_title: 播客标题
        original_filename: 原始音频文件名
        source_url: 播客来源链接
    
    Returns:
        str: 格式化的Markdown内容
    """
    from datetime import datetime
    
    # 获取当前时间
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # 优先使用播客标题，否则使用文件名
    if podcast_title:
        title = f"# 📝 {podcast_title}"
    elif original_filename:
        audio_name = Path(original_filename).stem
        title = f"# 📝 {audio_name}"
    else:
        title = "# 📝 Podcast转录"
    
    # 添加source链接（如果提供）
    source_section = f"\n\n---\n\n**Source:** {source_url}" if source_url else ""
    
    markdown_content = f"""{title}

{transcript_text}{source_section}
"""
    
    return markdown_content

def save_transcript_to_file(transcript_text, save_dir, file_prefix=None, original_filename=None, source_url=None, podcast_title=None):
    """
    保存转录文本到文件
    
    Args:
        transcript_text: 转录文本
        save_dir: 保存目录
        file_prefix: 文件前缀
        original_filename: 原始音频文件名
        source_url: 播客来源链接
    
    Returns:
        dict: 保存的文件信息
    """
    try:
        save_path = Path(save_dir)
        save_path.mkdir(parents=True, exist_ok=True)
        
        # 生成文件名
        if file_prefix:
            filename = f"{file_prefix}_transcript.md"
        elif original_filename:
            audio_name = Path(original_filename).stem
            timestamp = int(time.time())
            filename = f"{audio_name}_transcript_{timestamp}.md"
        else:
            timestamp = int(time.time())
            filename = f"transcript_{timestamp}.md"
        
        file_path = save_path / filename
        
        # 格式化为Markdown
        markdown_content = format_transcript_as_markdown(transcript_text, podcast_title, original_filename, source_url)
        
        # 保存文件
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(markdown_content)
        
        # 获取文件信息
        file_size = file_path.stat().st_size
        
        file_info = {
            "type": "transcript",
            "filename": filename,
            "path": str(file_path),
            "size": file_size
        }
        
        print(f"📄 转录文本已保存: {file_path} ({file_size/1024:.1f}KB)", file=sys.stderr)
        return file_info
        
    except Exception as e:
        print(f"❌ 保存转录文件失败: {e}", file=sys.stderr)
        return None

def main():
    parser = argparse.ArgumentParser(description="本地Faster-Whisper音频转录")
    parser.add_argument("files", nargs="+", help="音频文件路径")
    parser.add_argument("--model", default="base", 
                       choices=["tiny", "base", "small", "medium", "large-v3"],
                       help="Whisper模型大小 (默认: base)")
    parser.add_argument("--language", help="指定语言代码 (如: zh, en)")
    parser.add_argument("--device", default="cpu", 
                       choices=["cpu", "cuda"], help="计算设备")
    parser.add_argument("--compute-type", default="int8",
                       choices=["int8", "int16", "float16", "float32"],
                       help="计算精度")
    parser.add_argument("--output", help="输出JSON文件路径")
    parser.add_argument("--save-transcript", help="直接保存转录文本到指定目录")
    parser.add_argument("--file-prefix", help="保存文件的前缀名称")
    parser.add_argument("--source-url", help="播客来源链接")
    parser.add_argument("--podcast-title", help="播客标题")
    
    args = parser.parse_args()
    
    # 验证文件存在
    audio_files = []
    for file_path in args.files:
        path = Path(file_path)
        if not path.exists():
            print(f"❌ 文件不存在: {file_path}", file=sys.stderr)
            sys.exit(1)
        audio_files.append(str(path.absolute()))
    
    try:
        # 初始化转录器
        transcriber = LocalWhisperTranscriber(
            model_size=args.model,
            device=args.device,
            compute_type=args.compute_type.replace("-", "_")
        )
        
        # 执行转录
        if len(audio_files) == 1:
            result = transcriber.transcribe_file(audio_files[0], args.language)
        else:
            result = transcriber.transcribe_multiple(audio_files, args.language)
        
        # 处理转录文本保存
        saved_files = []
        if args.save_transcript and isinstance(result, dict) and result.get('success') and result.get('text'):
            file_info = save_transcript_to_file(
                transcript_text=result['text'],
                save_dir=args.save_transcript,
                file_prefix=args.file_prefix,
                original_filename=audio_files[0] if len(audio_files) == 1 else None,
                source_url=args.source_url,
                podcast_title=args.podcast_title
            )
            if file_info:
                saved_files.append(file_info)
        
        # 在结果中添加保存的文件信息
        if isinstance(result, dict):
            result['savedFiles'] = saved_files
        
        # 输出结果
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            print(f"📁 结果已保存到: {args.output}", file=sys.stderr)
        else:
            # 输出到stdout
            print(json.dumps(result, ensure_ascii=False))
    
    except KeyboardInterrupt:
        print("\n⚠️ 转录被用户中断", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"❌ 程序错误: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
