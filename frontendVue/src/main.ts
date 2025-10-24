import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/global.css'
import 'leaflet/dist/leaflet.css'

createApp(App).use(router).mount('#app')