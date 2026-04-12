import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Dimensions, Image, TouchableOpacity,
  ScrollView, Animated, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import COLORS from '../constants/colors';

var { width, height } = Dimensions.get('window');

var slides = [
  {
    image: require('../../assets/onboarding1.jpg'),
    title: 'Votre chauffeur en un clic',
    subtitle: 'Commandez une course en quelques secondes, partout a Dakar',
  },
  {
    image: require('../../assets/onboarding2.jpg'),
    title: 'Courses, livraisons et plus',
    subtitle: 'Transport, colis, commandes, restaurants \u2014 tout dans une app',
  },
  {
    image: require('../../assets/onboarding3.jpg'),
    title: 'Securite et confiance',
    subtitle: 'Votre securite est notre priorite absolue',
  },
];

var OnboardingScreen = function(props) {
  var navigation = props.navigation;
  var scrollRef = useRef(null);
  var activeIndexState = useState(0);
  var activeIndex = activeIndexState[0];
  var setActiveIndex = activeIndexState[1];
  var scrollX = useRef(new Animated.Value(0)).current;
  var fadeAnim = useRef(new Animated.Value(0)).current;
  var btnPulse = useRef(new Animated.Value(1)).current;

  useEffect(function() {
    // Fade in on mount
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  useEffect(function() {
    // Pulse button on last slide
    if (activeIndex === slides.length - 1) {
      Animated.loop(Animated.sequence([
        Animated.timing(btnPulse, { toValue: 1.05, duration: 800, useNativeDriver: true }),
        Animated.timing(btnPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])).start();
    } else {
      btnPulse.stopAnimation();
      btnPulse.setValue(1);
    }
  }, [activeIndex]);

  useEffect(function() {
    var interval = setInterval(function() {
      setActiveIndex(function(prev) {
        var next = (prev + 1) % slides.length;
        if (scrollRef.current) {
          scrollRef.current.scrollTo({ x: next * width, animated: true });
        }
        return next;
      });
    }, 4000);
    return function() { clearInterval(interval); };
  }, []);

  var handleDone = useCallback(function() {
    AsyncStorage.setItem('onboardingDone', '1').then(function() {
      navigation.replace('Login');
    });
  }, [navigation]);

  var onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  var onMomentumScrollEnd = function(e) {
    var index = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveIndex(index);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={16}
        bounces={false}
      >
        {slides.map(function(slide, index) {
          return (
            <Animated.View key={index} style={[styles.slide, { opacity: fadeAnim }]}>
              <Image source={slide.image} style={styles.bgImage} resizeMode="cover" />
              <LinearGradient
                colors={['rgba(0,0,0,0.15)', 'transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.92)']}
                locations={[0, 0.2, 0.5, 1]}
                style={styles.gradient}
              />
              <View style={styles.logoContainer}>
                <View style={styles.logoCircle}>
                  <Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
                </View>
                <Text style={styles.brandName}>Teran<Text style={{color: COLORS.yellow}}>GO</Text></Text>
              </View>
              <View style={styles.textContainer}>
                <View style={styles.textBg}>
                  <Text style={styles.title}>{slide.title}</Text>
                  <Text style={styles.subtitle}>{slide.subtitle}</Text>
                </View>
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>

      <View style={styles.bottomContainer}>
        <View style={styles.dotsRow}>
          {slides.map(function(_, i) {
            var dotWidth = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            var dotOpacity = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [0.4, 1, 0.4],
              extrapolate: 'clamp',
            });
            var dotColor = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: ['#FFFFFF', COLORS.yellow, '#FFFFFF'],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[styles.dot, { width: dotWidth, opacity: dotOpacity, backgroundColor: dotColor }]}
              />
            );
          })}
        </View>

        {activeIndex < slides.length - 1 && (
          <TouchableOpacity onPress={handleDone} style={styles.skipBtn}>
            <Text style={styles.skipText}>Passer</Text>
          </TouchableOpacity>
        )}

        <Animated.View style={{ width: '100%', transform: [{ scale: btnPulse }] }}>
          <TouchableOpacity style={styles.commencerBtn} onPress={handleDone} activeOpacity={0.85}>
            <Text style={styles.commencerText}>Commencer</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  slide: { width: width, height: height },
  bgImage: { width: width, height: height, position: 'absolute' },
  gradient: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  logoContainer: { position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center' },
  brandName: { fontSize: 20, fontFamily: 'LexendDeca_700Bold', color: '#FFFFFF', marginTop: 8, letterSpacing: -0.5 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8, overflow: 'hidden',
  },
  logo: { width: 68, height: 68 },
  textContainer: {
    position: 'absolute', bottom: 200, left: 0, right: 0,
    paddingHorizontal: 28, alignItems: 'center',
  },
  textBg: {
    backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 20, paddingVertical: 24, paddingHorizontal: 20,
    alignItems: 'center', backdropFilter: 'blur(10px)',
  },
  title: {
    fontSize: 30, fontFamily: 'LexendDeca_700Bold', color: '#FFFFFF',
    textAlign: 'center', marginBottom: 12, lineHeight: 38,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 16, fontFamily: 'LexendDeca_400Regular', color: 'rgba(255,255,255,0.9)',
    textAlign: 'center', lineHeight: 24,
    textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  bottomContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 28, paddingBottom: 50, alignItems: 'center',
  },
  dotsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 8 },
  dot: { height: 8, borderRadius: 4 },
  skipBtn: { marginBottom: 14 },
  skipText: { color: 'rgba(255,255,255,0.6)', fontSize: 15, fontFamily: 'LexendDeca_500Medium' },
  commencerBtn: {
    backgroundColor: COLORS.green, width: '100%', paddingVertical: 18,
    borderRadius: 16, alignItems: 'center',
    shadowColor: COLORS.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  commencerText: { color: '#FFFFFF', fontSize: 17, fontFamily: 'LexendDeca_700Bold' },
});

export default OnboardingScreen;
