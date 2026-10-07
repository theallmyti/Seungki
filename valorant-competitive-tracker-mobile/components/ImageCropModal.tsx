import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Platform,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { Colors } from '../theme/colors';

interface ImageCropModalProps {
    visible: boolean;
    imageUri: string; // data:image/... URI
    onCrop: (croppedBase64: string) => void;
    onCancel: () => void;
}

// Web-only canvas crop modal
function WebCropModal({ visible, imageUri, onCrop, onCancel }: ImageCropModalProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [imgLoaded, setImgLoaded] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [cropBox, setCropBox] = useState({ x: 0, y: 0, size: 200 });
    const containerRef = useRef<HTMLDivElement>(null);

    const CANVAS_SIZE = Math.min(Dimensions.get('window').width - 48, 360);

    useEffect(() => {
        if (!visible || !imageUri) return;
        setImgLoaded(false);
        const img = new Image();
        img.onload = () => {
            imgRef.current = img;
            setImgLoaded(true);
            const initSize = Math.floor(CANVAS_SIZE * 0.7);
            const initX = Math.floor((CANVAS_SIZE - initSize) / 2);
            setCropBox({ x: initX, y: initX, size: initSize });
        };
        img.src = imageUri;
    }, [visible, imageUri]);

    useEffect(() => {
        if (!imgLoaded || !canvasRef.current || !imgRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = CANVAS_SIZE;
        canvas.height = CANVAS_SIZE;

        // Scale image to fit canvas
        const img = imgRef.current;
        const scale = Math.max(CANVAS_SIZE / img.naturalWidth, CANVAS_SIZE / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        const dx = (CANVAS_SIZE - dw) / 2;
        const dy = (CANVAS_SIZE - dh) / 2;

        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.drawImage(img, dx, dy, dw, dh);

        // Darken overlay
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        // Cut out the crop circle (clear it back)
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(
            cropBox.x + cropBox.size / 2,
            cropBox.y + cropBox.size / 2,
            cropBox.size / 2,
            0, Math.PI * 2
        );
        ctx.fill();
        ctx.restore();

        // Redraw image inside circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(
            cropBox.x + cropBox.size / 2,
            cropBox.y + cropBox.size / 2,
            cropBox.size / 2,
            0, Math.PI * 2
        );
        ctx.clip();
        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.restore();

        // Draw circle border
        ctx.beginPath();
        ctx.arc(
            cropBox.x + cropBox.size / 2,
            cropBox.y + cropBox.size / 2,
            cropBox.size / 2,
            0, Math.PI * 2
        );
        ctx.strokeStyle = '#4ADE80';
        ctx.lineWidth = 2;
        ctx.stroke();
    }, [imgLoaded, cropBox, CANVAS_SIZE]);

    const getRelativePos = (e: any) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const handleMouseDown = (e: any) => {
        const pos = getRelativePos(e);
        const cx = cropBox.x + cropBox.size / 2;
        const cy = cropBox.y + cropBox.size / 2;
        const dist = Math.sqrt((pos.x - cx) ** 2 + (pos.y - cy) ** 2);
        if (dist <= cropBox.size / 2) {
            setIsDragging(true);
            setDragStart({ x: pos.x - cropBox.x, y: pos.y - cropBox.y });
        }
    };

    const handleMouseMove = (e: any) => {
        if (!isDragging) return;
        const pos = getRelativePos(e);
        const newX = Math.max(0, Math.min(CANVAS_SIZE - cropBox.size, pos.x - dragStart.x));
        const newY = Math.max(0, Math.min(CANVAS_SIZE - cropBox.size, pos.y - dragStart.y));
        setCropBox(prev => ({ ...prev, x: newX, y: newY }));
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleCrop = () => {
        if (!canvasRef.current || !imgRef.current) return;
        const img = imgRef.current;
        const output = document.createElement('canvas');
        output.width = 256;
        output.height = 256;
        const ctx = output.getContext('2d');
        if (!ctx) return;

        const scale = Math.max(CANVAS_SIZE / img.naturalWidth, CANVAS_SIZE / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        const dx = (CANVAS_SIZE - dw) / 2;
        const dy = (CANVAS_SIZE - dh) / 2;

        const srcX = (cropBox.x - dx) / scale;
        const srcY = (cropBox.y - dy) / scale;
        const srcSize = cropBox.size / scale;

        // Clip to circle
        ctx.beginPath();
        ctx.arc(128, 128, 128, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, 256, 256);

        const base64 = output.toDataURL('image/jpeg', 0.8);
        onCrop(base64);
    };

    if (Platform.OS !== 'web') return null;

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <Text style={styles.title}>Crop Profile Photo</Text>
                    <Text style={styles.subtitle}>Drag the circle to position your photo</Text>

                    {!imgLoaded ? (
                        <View style={{ width: CANVAS_SIZE, height: CANVAS_SIZE, justifyContent: 'center', alignItems: 'center' }}>
                            <ActivityIndicator color={Colors.accent} />
                        </View>
                    ) : (
                        // @ts-ignore - web only canvas
                        <canvas
                            ref={canvasRef}
                            width={CANVAS_SIZE}
                            height={CANVAS_SIZE}
                            style={{ borderRadius: 12, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onTouchStart={handleMouseDown}
                            onTouchMove={handleMouseMove}
                            onTouchEnd={handleMouseUp}
                        />
                    )}

                    <View style={styles.buttonRow}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cropBtn} onPress={handleCrop} disabled={!imgLoaded}>
                            <Text style={styles.cropText}>Use Photo</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

export default function ImageCropModal(props: ImageCropModalProps) {
    // On native, expo-image-picker handles cropping natively — this component is web-only
    if (Platform.OS !== 'web') {
        return null;
    }
    return <WebCropModal {...props} />;
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    container: {
        backgroundColor: '#1E1E1E',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        width: '100%',
        maxWidth: 420,
    },
    title: {
        fontSize: 20,
        fontFamily: 'Inter_700Bold',
        color: '#FFFFFF',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 13,
        fontFamily: 'Inter_400Regular',
        color: '#9CA3AF',
        marginBottom: 20,
        textAlign: 'center',
    },
    buttonRow: {
        flexDirection: 'row',
        marginTop: 20,
        width: '100%',
        gap: 12,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
    },
    cancelText: {
        color: '#FFFFFF',
        fontFamily: 'Inter_600SemiBold',
        fontSize: 16,
    },
    cropBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#4ADE80',
        alignItems: 'center',
    },
    cropText: {
        color: '#0D0D0D',
        fontFamily: 'Inter_700Bold',
        fontSize: 16,
    },
});
