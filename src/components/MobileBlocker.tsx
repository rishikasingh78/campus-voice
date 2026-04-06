import { motion } from "framer-motion";
import { Monitor, Laptop, AlertTriangle, X } from "lucide-react";

const MobileBlocker = () => {
  return (
    <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center p-6 md:hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>
      
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
        className="relative bg-card/90 backdrop-blur-xl border border-border rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
      >
        <motion.div
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <div className="w-20 h-20 mx-auto bg-destructive/20 rounded-full flex items-center justify-center mb-4">
            <motion.div
              animate={{ 
                rotate: [0, -10, 10, -10, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                duration: 0.5,
                repeat: Infinity,
                repeatDelay: 2
              }}
            >
              <AlertTriangle className="w-10 h-10 text-destructive" />
            </motion.div>
          </div>
          
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-bold text-foreground mb-2"
          >
            Desktop Only
          </motion.h1>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-muted-foreground text-sm leading-relaxed"
          >
            <p className="mb-4">
              This platform is optimized for desktop experience only. 
              Please access from a laptop or computer for the best experience.
            </p>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex justify-center gap-6 mb-6"
        >
          <motion.div
            whileHover={{ scale: 1.1 }}
            className="flex flex-col items-center gap-2"
          >
            <div className="w-14 h-14 bg-primary/20 rounded-xl flex items-center justify-center">
              <Laptop className="w-7 h-7 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">Laptop</span>
          </motion.div>
          
          <motion.div
            whileHover={{ scale: 1.1 }}
            className="flex flex-col items-center gap-2"
          >
            <div className="w-14 h-14 bg-primary/20 rounded-xl flex items-center justify-center">
              <Monitor className="w-7 h-7 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">Desktop</span>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="pt-4 border-t border-border"
        >
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <X className="w-4 h-4 text-destructive" />
            <span>Mobile & Tablet Not Supported</span>
          </div>
        </motion.div>

        <motion.div
          className="absolute -top-2 -right-2 w-6 h-6 bg-destructive rounded-full flex items-center justify-center"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <span className="text-destructive-foreground text-xs font-bold">!</span>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default MobileBlocker;
