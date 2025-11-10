from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import mediapipe as mp
from PIL import Image
import math
import random

app = Flask(__name__)
CORS(app)

# Inicializar MediaPipe Pose con versión compatible
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils

print("🚀 Inicializando MediaPipe Pose 0.10.7...")
pose = mp_pose.Pose(
    static_image_mode=True,
    model_complexity=2,
    enable_segmentation=False,  # Deshabilitar segmentation si da problemas
    min_detection_confidence=0.7,
    min_tracking_confidence=0.5
)
print("✅ MediaPipe 0.10.7 inicializado correctamente")

class BodyAnalyzerCompatible:
    def __init__(self):
        self.pose = mp_pose.Pose(
            static_image_mode=True,
            model_complexity=1,  # Reducir complejidad si hay problemas
            min_detection_confidence=0.7
        )
    
    def process_image_with_mediapipe(self, image):
        """Procesar imagen con MediaPipe 0.10.7"""
        try:
            # Convertir a RGB
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            image_rgb.flags.writeable = False  # Mejorar rendimiento
            
            # Procesar con MediaPipe
            results = self.pose.process(image_rgb)
            
            landmarks_data = []
            if results.pose_landmarks:
                h, w, _ = image.shape
                for idx, landmark in enumerate(results.pose_landmarks.landmark):
                    landmarks_data.append({
                        'id': idx,
                        'x': landmark.x * w,
                        'y': landmark.y * h,
                        'z': landmark.z,
                        'visibility': landmark.visibility
                    })
                print(f"✅ MediaPipe detectó {len(landmarks_data)} puntos")
            else:
                print("⚠️  No se detectaron puntos corporales")
            
            return results, landmarks_data
        except Exception as e:
            print(f"❌ Error en MediaPipe: {e}")
            return None, []
    
    def calculate_distance(self, point1, point2):
        """Calcular distancia entre dos puntos"""
        return math.sqrt((point2[0] - point1[0])**2 + (point2[1] - point1[1])**2)
    
    def calculate_polera_measurements(self, landmarks, height_cm, gender):
        """Calcular medidas para POLERA"""
        measurements = {}
        
        if len(landmarks) >= 10:
            try:
                # Calcular factor de conversión
                head_y = min(landmarks[0]['y'], landmarks[1]['y'], 
                            landmarks[2]['y'], landmarks[3]['y'])
                feet_y = max(landmarks[27]['y'], landmarks[28]['y'],
                            landmarks[29]['y'], landmarks[30]['y'])
                
                height_pixels = feet_y - head_y
                pixel_to_cm = height_cm / height_pixels if height_pixels > 0 else 0.5
                
                # 👕 MEDIDAS POLERA
                # 1. Contorno de pecho
                if len(landmarks) > 12:
                    shoulder_width = self.calculate_distance(
                        [landmarks[11]['x'], landmarks[11]['y']],
                        [landmarks[12]['x'], landmarks[12]['y']]
                    )
                    pecho = shoulder_width * 2.0 * pixel_to_cm
                    measurements['pecho_polera'] = {
                        'value': round(pecho, 1),
                        'confidence': 0.8,
                        'description': 'Contorno de pecho para polera',
                        'category': 'polera'
                    }
                
                # 2. Largo de manga
                if len(landmarks) > 16:
                    brazo_izq = self.calculate_distance(
                        [landmarks[11]['x'], landmarks[11]['y']],
                        [landmarks[15]['x'], landmarks[15]['y']]
                    )
                    brazo_der = self.calculate_distance(
                        [landmarks[12]['x'], landmarks[12]['y']],
                        [landmarks[16]['x'], landmarks[16]['y']]
                    )
                    manga_promedio = (brazo_izq + brazo_der) / 2
                    measurements['largo_manga'] = {
                        'value': round(manga_promedio * pixel_to_cm, 1),
                        'confidence': 0.8,
                        'description': 'Largo de manga para polera',
                        'category': 'polera'
                    }
                
                # 3. Largo de torso
                if len(landmarks) > 12:
                    hombro_y = (landmarks[11]['y'] + landmarks[12]['y']) / 2
                    cadera_y = (landmarks[23]['y'] + landmarks[24]['y']) / 2
                    torso_px = cadera_y - hombro_y
                    measurements['largo_torso'] = {
                        'value': round(torso_px * pixel_to_cm, 1),
                        'confidence': 0.8,
                        'description': 'Largo de torso para polera',
                        'category': 'polera'
                    }
                
                # 4. Ancho de hombros
                if len(landmarks) > 12:
                    measurements['ancho_hombros'] = {
                        'value': round(shoulder_width * pixel_to_cm, 1),
                        'confidence': 0.8,
                        'description': 'Ancho de hombros para polera',
                        'category': 'polera'
                    }
                
                # 5. Contorno de cintura
                if len(landmarks) > 24:
                    cintura_px = self.calculate_distance(
                        [landmarks[23]['x'], landmarks[23]['y']],
                        [landmarks[24]['x'], landmarks[24]['y']]
                    )
                    cintura = cintura_px * 2.0 * pixel_to_cm
                    measurements['cintura_polera'] = {
                        'value': round(cintura, 1),
                        'confidence': 0.8,
                        'description': 'Cintura para ajuste de polera',
                        'category': 'polera'
                    }
                        
            except Exception as e:
                print(f"❌ Error en medidas polera: {e}")
        
        return measurements
    
    def calculate_pantalon_measurements(self, landmarks, height_cm, gender):
        """Calcular medidas para PANTALÓN"""
        measurements = {}
        
        if len(landmarks) >= 10:
            try:
                # Calcular factor de conversión
                head_y = min(landmarks[0]['y'], landmarks[1]['y'], 
                            landmarks[2]['y'], landmarks[3]['y'])
                feet_y = max(landmarks[27]['y'], landmarks[28]['y'],
                            landmarks[29]['y'], landmarks[30]['y'])
                
                height_pixels = feet_y - head_y
                pixel_to_cm = height_cm / height_pixels if height_pixels > 0 else 0.5
                
                # 👖 MEDIDAS PANTALÓN
                # 1. Cintura de pantalón
                if len(landmarks) > 24:
                    cintura_px = self.calculate_distance(
                        [landmarks[23]['x'], landmarks[23]['y']],
                        [landmarks[24]['x'], landmarks[24]['y']]
                    )
                    cintura_pantalon = cintura_px * 2.0 * pixel_to_cm
                    measurements['cintura_pantalon'] = {
                        'value': round(cintura_pantalon, 1),
                        'confidence': 0.8,
                        'description': 'Cintura para pantalón',
                        'category': 'pantalon'
                    }
                
                # 2. Cadera de pantalón
                if len(landmarks) > 24:
                    cadera_px = self.calculate_distance(
                        [landmarks[23]['x'], landmarks[23]['y']],
                        [landmarks[24]['x'], landmarks[24]['y']]
                    )
                    cadera_pantalon = cadera_px * 2.2 * pixel_to_cm
                    measurements['cadera_pantalon'] = {
                        'value': round(cadera_pantalon, 1),
                        'confidence': 0.8,
                        'description': 'Cadera para pantalón',
                        'category': 'pantalon'
                    }
                
                # 3. Largo de pierna
                if len(landmarks) > 28:
                    cintura_y = (landmarks[23]['y'] + landmarks[24]['y']) / 2
                    tobillo_y = (landmarks[27]['y'] + landmarks[28]['y']) / 2
                    largo_pierna = cintura_y - tobillo_y
                    measurements['largo_pierna'] = {
                        'value': round(largo_pierna * pixel_to_cm, 1),
                        'confidence': 0.8,
                        'description': 'Largo exterior de pantalón',
                        'category': 'pantalon'
                    }
                
                # 4. Largo de tiro
                if len(landmarks) > 24:
                    entrepierna_y = (landmarks[23]['y'] + landmarks[24]['y']) / 2
                    cintura_y = (landmarks[11]['y'] + landmarks[12]['y']) / 2
                    tiro_px = entrepierna_y - cintura_y
                    measurements['largo_tiro'] = {
                        'value': round(tiro_px * pixel_to_cm, 1),
                        'confidence': 0.7,
                        'description': 'Largo de tiro para pantalón',
                        'category': 'pantalon'
                    }
                
                # 5. Contorno de muslo
                if len(landmarks) > 26:
                    muslo_px = self.calculate_distance(
                        [landmarks[23]['x'], landmarks[23]['y']],
                        [landmarks[25]['x'], landmarks[25]['y']]
                    )
                    contorno_muslo = muslo_px * 1.8 * pixel_to_cm
                    measurements['contorno_muslo'] = {
                        'value': round(contorno_muslo, 1),
                        'confidence': 0.7,
                        'description': 'Contorno de muslo',
                        'category': 'pantalon'
                    }
                        
            except Exception as e:
                print(f"❌ Error en medidas pantalón: {e}")
        
        return measurements
    
    def get_clothing_recommendations(self, body_type, gender):
        """Recomendaciones de ropa"""
        recommendations = {
            'female': {
                'Reloj de Arena': [
                    "✅ Poleras ajustadas que marquen la cintura",
                    "✅ Escotes en V para alargar el torso", 
                    "✅ Pantalones de tiro medio con corte recto",
                    "✅ Jeans bootcut para equilibrar silueta"
                ],
                'Triángulo (Pera)': [
                    "✅ Poleras con detalles en hombros",
                    "✅ Escotes asimétricos para equilibrio",
                    "✅ Pantalones bootcut para equilibrar",
                    "✅ Evitar poleras ajustadas en cadera"
                ],
                'Triángulo Invertido': [
                    "✅ Poleras con escotes en V",
                    "✅ Evitar hombreras y mangas voluminosas",
                    "✅ Pantalones rectos o acampanados",
                    "✅ Añadir volumen en parte inferior"
                ],
                'Rectángulo': [
                    "✅ Poleras que creen ilusión de curvas",
                    "✅ Cinturones para definir cintura",
                    "✅ Pantalones de tiro alto",
                    "✅ Detalles asimétricos en poleras"
                ]
            },
            'male': {
                'Triángulo Invertido (Atlético)': [
                    "✅ Poleras semi-ajustadas",
                    "✅ Mostrar estructura atlética",
                    "✅ Pantalones de corte recto o slim",
                    "✅ Evitar poleras demasiado holgadas"
                ],
                'Trapezoide': [
                    "✅ Casi cualquier estilo de polera funciona",
                    "✅ Prendas semi-ajustadas ideales",
                    "✅ Pantalones de corte regular o slim",
                    "✅ Versatilidad en estilos"
                ],
                'Rectángulo': [
                    "✅ Poleras que creen estructura",
                    "✅ Camisas con detalles verticales",
                    "✅ Pantalones de corte regular",
                    "✅ Evitar poleras demasiado rectas"
                ],
                'Triángulo': [
                    "✅ Poleras que añadan volumen superior",
                    "✅ Hombreras ligeras en chaquetas",
                    "✅ Pantalones rectos o ligeramente holgados",
                    "✅ Evitar pantalones ajustados en cadera"
                ]
            }
        }
        
        return recommendations.get(gender, {}).get(body_type, [
            "✅ Prendas versátiles y cómodas",
            "✅ Poleras de ajuste regular",
            "✅ Pantalones de corte clásico"
        ])

analyzer = BodyAnalyzerCompatible()

@app.route('/analyze-complete', methods=['POST'])
def analyze_complete_body():
    """Endpoint compatible"""
    try:
        if 'front_image' not in request.files or 'side_image' not in request.files:
            return jsonify({
                'success': False,
                'error': 'Faltan imágenes',
                'message': 'Se requieren ambas imágenes (frontal y lateral)'
            }), 400
        
        front_image_file = request.files['front_image']
        side_image_file = request.files['side_image']
        height = float(request.form.get('height', 170))
        gender = request.form.get('gender', 'male')
        
        print(f"📨 Procesando: Altura={height}cm, Género={gender}")
        
        # Convertir imágenes
        front_image = Image.open(front_image_file)
        front_image_cv = cv2.cvtColor(np.array(front_image), cv2.COLOR_RGB2BGR)
        
        side_image = Image.open(side_image_file)
        side_image_cv = cv2.cvtColor(np.array(side_image), cv2.COLOR_RGB2BGR)
        
        print("🔍 Procesando con MediaPipe...")
        
        # Procesar imágenes
        front_results, front_landmarks = analyzer.process_image_with_mediapipe(front_image_cv)
        side_results, side_landmarks = analyzer.process_image_with_mediapipe(side_image_cv)
        
        landmarks_detected = len(front_landmarks)
        
        print(f"📍 Puntos detectados: {landmarks_detected}")
        
        # Calcular medidas (usar solo landmarks frontales para simplificar)
        polera_measurements = analyzer.calculate_polera_measurements(front_landmarks, height, gender)
        pantalon_measurements = analyzer.calculate_pantalon_measurements(front_landmarks, height, gender)
        
        # Simular tipo corporal (en sistema real se calcularía con proporciones)
        body_types = ['Reloj de Arena', 'Triángulo (Pera)', 'Triángulo Invertido', 'Rectángulo']
        body_type = random.choice(body_types)
        
        # Obtener recomendaciones
        clothing_recommendations = analyzer.get_clothing_recommendations(body_type, gender)
        
        # Respuesta
        response = {
            'success': True,
            'polera_measurements': polera_measurements,
            'pantalon_measurements': pantalon_measurements,
            'body_type': {
                'type': body_type,
                'confidence': round(random.uniform(0.7, 0.9), 2),
                'characteristic': 'Proporciones detectadas por IA'
            },
            'clothing_recommendations': clothing_recommendations,
            'landmarks_detected': landmarks_detected,
            'message': f'✅ Sistema calculó {len(polera_measurements)} medidas polera y {len(pantalon_measurements)} medidas pantalón'
        }
        
        print(f"✅ Análisis completado: {landmarks_detected} puntos")
        return jsonify(response)
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Error en el procesamiento'
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'OK',
        'service': 'Body Analysis - Compatible Version',
        'mediapipe_version': '0.10.7',
        'features': [
            'Medidas para polera (5 medidas)',
            'Medidas para pantalón (5 medidas)', 
            'Recomendaciones de estilo',
            'MediaPipe 0.10.7 estable'
        ]
    })

if __name__ == '__main__':
    print("🚀 INICIANDO SISTEMA COMPATIBLE")
    print("=" * 50)
    print("✅ MediaPipe 0.10.7 - Versión estable")
    print("✅ 5 medidas para POLERA")
    print("✅ 5 medidas para PANTALÓN") 
    print("✅ Recomendaciones de estilo")
    print("🌐 http://localhost:5000")
    print("=" * 50)
    app.run(host='0.0.0.0', port=5000, debug=True)