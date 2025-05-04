import matplotlib.pyplot as plt
import matplotlib.animation as animation
import pandas as pd
import numpy as np
from mpl_toolkits.mplot3d import Axes3D
from matplotlib.widgets import Button, Slider
import matplotlib.text as mtext

def load_simulation_data(filename):
    """Load simulation data from CSV file"""
    data = pd.read_csv(filename)
    return data

def create_animation(data, output_file=None):
    """Create 3D animation of the N-body simulation"""
    # Extract simulation parameters from data
    # Time step used in simulation (from the C++ code)
    TIME_STEP = 0.01  # seconds per simulation step
    
    # Get unique iterations and bodies
    iterations = np.sort(data['iteration'].unique())  # Sort to ensure correct order
    bodies = data['body_id'].unique()
    num_bodies = len(bodies)
    
    # Check if this is a solar system simulation
    is_solar_system = any(name == 'Sun' for name in data['name'].unique())
    
    # Set up color map for different bodies
    colors = plt.cm.jet(np.linspace(0, 1, num_bodies))
    
    # Create figure and 3D axis
    fig = plt.figure(figsize=(12, 10))
    
    # Add control panel at the bottom
    ax_main = plt.subplot2grid((5, 1), (0, 0), rowspan=4, projection='3d')
    ax_controls = plt.subplot2grid((5, 1), (4, 0))
    ax_controls.axis('off')  # Hide the axis for the controls area
    
    # Find data ranges for consistent scaling
    x_min, x_max = data['x'].min(), data['x'].max()
    y_min, y_max = data['y'].min(), data['y'].max()
    z_min, z_max = data['z'].min(), data['z'].max()
    
    # Get the maximum range for equal aspect ratio
    max_range = max(x_max - x_min, y_max - y_min, z_max - z_min) / 2
    mid_x = (x_max + x_min) / 2
    mid_y = (y_max + y_min) / 2
    mid_z = (z_max + z_min) / 2
    
    # Get mass for scaling point sizes
    max_mass = data['mass'].max()
    min_mass = data['mass'].min()
    
    # Initialize plots with empty data
    scatters = []
    trails = []
    
    for i in range(num_bodies):
        # Create scatter plots for bodies
        scatter = ax_main.scatter([], [], [], s=50, c=[colors[i]], label=f"Body {i}")
        scatters.append(scatter)
        
        # Create lines for trails
        trail, = ax_main.plot([], [], [], '-', linewidth=1, alpha=0.3, c=colors[i])
        trails.append(trail)
    
    # Set axis limits for consistent view
    ax_main.set_xlim(mid_x - max_range, mid_x + max_range)
    ax_main.set_ylim(mid_y - max_range, mid_y + max_range)
    ax_main.set_zlim(mid_z - max_range, mid_z + max_range)
    
    ax_main.set_xlabel('X')
    ax_main.set_ylabel('Y')
    ax_main.set_zlabel('Z')
    ax_main.set_title('N-Body Simulation')
    
    # Add information text elements
    timestamp_text = ax_main.text2D(0.05, 0.95, "", transform=ax_main.transAxes)
    speed_text = ax_main.text2D(0.05, 0.90, "", transform=ax_main.transAxes)
    
    # Add legend
    body_names = data.groupby('body_id')['name'].first().tolist()
    legend_elements = [plt.Line2D([0], [0], marker='o', color='w', 
                                 label=name,
                                 markerfacecolor=colors[i], markersize=8)
                      for i, name in enumerate(body_names)]
    ax_main.legend(handles=legend_elements, loc='upper right')
    
    # Track trail history
    history = [[] for _ in range(num_bodies)]
    trail_length = 20  # Keep only the last 20 positions for trails
    
    # Animation control variables
    paused = False
    frame_counter = 0
    speed_factor = 1.0  # Speed multiplier
    
    # Timeline information
    if is_solar_system:
        # For solar system, each time step represents hours/days for better visualization
        time_multiplier = 3600 * 24  # 1 second of sim time = 1 day of real time
        time_unit = "days"
    else:
        # For generic simulation
        time_multiplier = 1.0
        time_unit = "seconds"
    
    def init():
        for scatter in scatters:
            scatter._offsets3d = ([], [], [])
        for trail in trails:
            trail.set_data([], [])
            trail.set_3d_properties([])
        timestamp_text.set_text("")
        speed_text.set_text("")
        return scatters + trails + [timestamp_text, speed_text]
    
    def update_speed_text():
        # Calculate simulation speed relative to real time
        real_time_per_frame = interval / 1000.0  # seconds per frame
        sim_time_per_frame = TIME_STEP * speed_factor
        
        sim_to_real_ratio = sim_time_per_frame / real_time_per_frame
        
        if is_solar_system:
            speed_info = f"Speed: {sim_to_real_ratio:.1f}x real time (1 frame = {sim_time_per_frame * time_multiplier:.1f} {time_unit})"
        else:
            if sim_to_real_ratio >= 1:
                speed_info = f"Speed: {sim_to_real_ratio:.1f}x faster than real time"
            else:
                speed_info = f"Speed: {1/sim_to_real_ratio:.1f}x slower than real time"
        
        speed_text.set_text(speed_info)
    
    def animate(frame_idx):
        nonlocal frame_counter
        
        # If not paused, advance the frame counter
        if not paused:
            frame_counter = (frame_counter + 1) % len(iterations)
        
        # Get the current iteration from the sorted iterations array
        current_iteration = iterations[frame_counter]
        frame_data = data[data['iteration'] == current_iteration]
        
        for i, body_id in enumerate(bodies):
            body_data = frame_data[frame_data['body_id'] == body_id]
            if not body_data.empty:
                # Update body position
                x, y, z = body_data['x'].values[0], body_data['y'].values[0], body_data['z'].values[0]
                scatters[i]._offsets3d = ([x], [y], [z])
                
                # Update mass-based size
                mass = body_data['mass'].values[0]
                # Scale size logarithmically between 20 and 200 based on mass
                size = 20 + 180 * np.log(mass / min_mass) / np.log(max_mass / min_mass) if max_mass > min_mass else 50
                scatters[i].set_sizes([size])
                
                # Update trail
                history[i].append((x, y, z))
                if len(history[i]) > trail_length:
                    history[i] = history[i][-trail_length:]
                
                if history[i]:
                    xs, ys, zs = zip(*history[i])
                    trails[i].set_data(xs, ys)
                    trails[i].set_3d_properties(zs)
        
        # Update timestamp
        elapsed_time = current_iteration * TIME_STEP * time_multiplier
        if time_unit == "days":
            timestamp_text.set_text(f"Iteration: {current_iteration} (Time: {elapsed_time:.2f} {time_unit})")
        else:
            timestamp_text.set_text(f"Iteration: {current_iteration} (Time: {elapsed_time:.5f} {time_unit})")
        
        # Update speed text
        update_speed_text()
        
        return scatters + trails + [timestamp_text, speed_text]
    
    # Create animation
    interval = 50  # Default interval in milliseconds 
    ani = animation.FuncAnimation(fig, animate, frames=100,  # Use arbitrary frame count, we're manually tracking
                                 init_func=init, blit=False, interval=interval)
    
    # Add control buttons with fixed positions
    button_width = 0.1
    button_height = 0.04
    button_y = 0.05
    
    ax_play_pause = plt.axes([0.4, button_y, button_width, button_height])
    ax_slower = plt.axes([0.2, button_y, button_width, button_height])
    ax_faster = plt.axes([0.7, button_y, button_width, button_height])
    ax_reset = plt.axes([0.55, button_y, button_width, button_height])
    
    # Create buttons
    btn_play_pause = Button(ax_play_pause, 'Pause')
    btn_slower = Button(ax_slower, 'Slower')
    btn_faster = Button(ax_faster, 'Faster')
    btn_reset = Button(ax_reset, 'Reset')
    
    # Add callback functions
    def toggle_pause(event):
        nonlocal paused
        paused = not paused
        btn_play_pause.label.set_text('Play' if paused else 'Pause')
        fig.canvas.draw_idle()
    
    def slow_down(event):
        nonlocal interval, speed_factor
        # Increase interval (slower animation)
        interval = min(interval * 1.5, 500)
        speed_factor /= 1.5
        ani.event_source.interval = interval
        update_speed_text()
        fig.canvas.draw_idle()
        
    def speed_up(event):
        nonlocal interval, speed_factor
        # Decrease interval (faster animation)
        interval = max(interval / 1.5, 5)
        speed_factor *= 1.5
        ani.event_source.interval = interval
        update_speed_text()
        fig.canvas.draw_idle()
        
    def reset_animation(event):
        nonlocal paused, interval, frame_counter, speed_factor
        # Reset to initial state
        frame_counter = 0
        interval = 50
        speed_factor = 1.0
        ani.event_source.interval = interval
        if paused:
            paused = False
            btn_play_pause.label.set_text('Pause')
        update_speed_text()
        fig.canvas.draw_idle()
    
    # Connect callbacks to buttons
    btn_play_pause.on_clicked(toggle_pause)
    btn_slower.on_clicked(slow_down)
    btn_faster.on_clicked(speed_up)
    btn_reset.on_clicked(reset_animation)
    
    # Add trail length slider
    ax_trail = plt.axes([0.2, 0.12, 0.6, 0.02])
    trail_slider = Slider(ax_trail, 'Trail Length', 0, 50, valinit=trail_length, valstep=1)
    
    def update_trail_length(val):
        nonlocal trail_length
        trail_length = int(val)
        # Trim existing trails if needed
        for i in range(num_bodies):
            if len(history[i]) > trail_length:
                history[i] = history[i][-trail_length:]
    
    trail_slider.on_changed(update_trail_length)
    
    # Save animation if output file is provided
    if output_file:
        writer = animation.FFMpegWriter(fps=30, metadata=dict(artist='Me'), bitrate=1800)
        ani.save(output_file, writer=writer)
        print(f"Animation saved to {output_file}")
    
    update_speed_text()  # Initialize speed text
    plt.tight_layout()
    plt.subplots_adjust(bottom=0.2)  # Make room for controls
    plt.show()

if __name__ == "__main__":
    import sys
    import os
    
    # Default to looking in the current directory
    input_file = "nbody_simulation_results.csv"
    output_file = None
    
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
    
    # Check if file exists in current directory, if not, try N-body problem directory
    if not os.path.exists(input_file) and os.path.exists(os.path.join("N-body problem", input_file)):
        input_file = os.path.join("N-body problem", input_file)
    
    try:
        print(f"Loading simulation data from: {input_file}")
        data = load_simulation_data(input_file)
        create_animation(data, output_file)
    except Exception as e:
        print(f"Error: {e}")
        if "FFMpegWriter" in str(e):
            print("To save animations, you need to install FFmpeg.")
            print("Visit: https://ffmpeg.org/download.html")
        elif "No such file" in str(e):
            print(f"File not found: {input_file}")
            print("Please check the file path or run the C++ simulation first.")